<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Overtime;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use App\Models\WorkloadRisk;
use App\Models\WorkLog;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class WorkloadRiskService
{
    /**
     * Centralized model thresholds and indicator weights (NFR-07 configurable).
     *
     * @return array<string, mixed>
     */
    public function getThresholds(): array
    {
        $defaults = [
            'normal_weekly_hours_threshold' => 40.0,
            'critical_weekly_hours_threshold' => 55.0,
            'max_daily_overtime_hours' => 4.0,
            'max_weekly_overtime_hours' => 18.0,
            'task_load_safe_ratio' => 1.0,
            'task_load_max_ratio' => 1.5,
            'deadline_window_days' => 7,
            'medium_risk_threshold' => 40.0,
            'high_risk_threshold' => 70.0,
            'weights' => [
                'weekly_hours' => 0.25,
                'overtime' => 0.25,
                'task_load' => 0.25,
                'deadline_pressure' => 0.25,
            ],
        ];

        $overrides = config('workbalance.workload_risk', []);

        return is_array($overrides) ? array_replace_recursive($defaults, $overrides) : $defaults;
    }

    /**
     * Recalculate and persist Workload Risk records in `workload_risks` for target scope.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function calculate(array $data, UserAccount $actor): array
    {
        [$periodWeek, $periodMonth, $weekStart, $weekEnd] = $this->resolveWeekWindow(
            $data['period_week'] ?? null,
            $data['period_month'] ?? null
        );

        $departmentId = ! empty($data['department_id']) ? (int) $data['department_id'] : null;
        $employeeId = ! empty($data['employee_id']) ? (int) $data['employee_id'] : null;

        $employeesQuery = Employee::query()
            ->where('status', 'active')
            ->with(['department', 'position', 'employmentType']);

        if ($departmentId !== null) {
            $employeesQuery->where('department_id', $departmentId);
        }

        if ($employeeId !== null) {
            $employeesQuery->where('id', $employeeId);
        }

        $targetEmployees = $employeesQuery->orderBy('employee_code')->get();
        $recalculated = $this->syncEmployeesWorkloadRisks($targetEmployees, $periodWeek, $periodMonth, $weekStart, $weekEnd);

        $listResult = $this->list([
            'period_week' => $periodWeek,
            'period_month' => $periodMonth,
            'department_id' => $departmentId,
            'employee_id' => $employeeId,
        ], $actor);

        $listResult['recalculated_count'] = $recalculated->count();

        return $listResult;
    }

    /**
     * Retrieve persisted & synchronized Workload Risk analyses scoped by actor role.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        if (
            $actor->role === 'employee'
            && isset($filters['employee_id'])
            && $filters['employee_id'] !== ''
            && (int) $filters['employee_id'] !== ($actor->employee?->id ?? 0)
        ) {
            throw new AccessDeniedHttpException('Anda hanya dapat melihat analisis risiko beban kerja milik Anda sendiri.');
        }

        [$periodWeek, $periodMonth, $weekStart, $weekEnd] = $this->resolveWeekWindow(
            $filters['period_week'] ?? null,
            $filters['period_month'] ?? null
        );

        $departmentId = ! empty($filters['department_id']) ? (int) $filters['department_id'] : null;
        $requestedEmployeeId = ! empty($filters['employee_id']) ? (int) $filters['employee_id'] : null;
        $riskCategoryFilter = ! empty($filters['risk_category']) && in_array($filters['risk_category'], ['low', 'medium', 'high'], true)
            ? (string) $filters['risk_category']
            : '';
        $overrideFilter = $filters['is_overridden'] ?? '';
        $search = trim((string) ($filters['search'] ?? ''));

        $scopeEmployeesQuery = Employee::query()
            ->where('status', 'active')
            ->with(['department', 'position', 'employmentType']);

        if ($actor->role === 'employee') {
            $scopeEmployeesQuery->where('id', $actor->employee?->id ?? 0);
        } else {
            if ($departmentId !== null) {
                $scopeEmployeesQuery->where('department_id', $departmentId);
            }
            if ($requestedEmployeeId !== null) {
                $scopeEmployeesQuery->where('id', $requestedEmployeeId);
            }
        }

        $scopedEmployees = $scopeEmployeesQuery->orderBy('employee_code')->get();
        $computedRows = $this->syncEmployeesWorkloadRisks($scopedEmployees, $periodWeek, $periodMonth, $weekStart, $weekEnd);

        // Compute unfiltered (role/dept scoped) summary before UI category/search filters
        $totalEmployees = $computedRows->count();
        $highRiskCount = $computedRows->where('risk_category', 'high')->count();
        $mediumRiskCount = $computedRows->where('risk_category', 'medium')->count();
        $lowRiskCount = $computedRows->where('risk_category', 'low')->count();
        $overriddenCount = $computedRows->where('is_overridden', true)->count();

        $summary = [
            'total_employees' => $totalEmployees,
            'high_risk_count' => $highRiskCount,
            'medium_risk_count' => $mediumRiskCount,
            'low_risk_count' => $lowRiskCount,
            'overridden_count' => $overriddenCount,
            'avg_final_score' => $totalEmployees > 0 ? round((float) $computedRows->avg('final_score'), 2) : 0.0,
            'avg_weekly_hours_score' => $totalEmployees > 0 ? round((float) $computedRows->avg('weekly_hours_score'), 2) : 0.0,
            'avg_overtime_score' => $totalEmployees > 0 ? round((float) $computedRows->avg('overtime_score'), 2) : 0.0,
            'avg_task_load_score' => $totalEmployees > 0 ? round((float) $computedRows->avg('task_load_score'), 2) : 0.0,
            'avg_deadline_pressure_score' => $totalEmployees > 0 ? round((float) $computedRows->avg('deadline_pressure_score'), 2) : 0.0,
            'total_weekly_hours' => round((float) $computedRows->sum(fn ($item) => (float) ($item['metrics']['weekly_hours_total'] ?? 0)), 2),
            'total_active_estimated_hours' => round((float) $computedRows->sum(fn ($item) => (float) ($item['metrics']['active_estimated_hours'] ?? 0)), 2),
        ];

        $filteredRows = $computedRows
            ->when($riskCategoryFilter !== '', fn (Collection $rows) => $rows->where('risk_category', $riskCategoryFilter))
            ->when($overrideFilter !== '', function (Collection $rows) use ($overrideFilter) {
                $val = strtolower((string) $overrideFilter);
                if (in_array($val, ['1', 'true', 'yes'], true)) {
                    return $rows->where('is_overridden', true);
                }
                if (in_array($val, ['0', 'false', 'no'], true)) {
                    return $rows->where('is_overridden', false);
                }

                return $rows;
            })
            ->when($search !== '', function (Collection $rows) use ($search) {
                $needle = mb_strtolower($search);

                return $rows->filter(function (array $item) use ($needle) {
                    $emp = $item['employee'] ?? [];
                    $haystack = mb_strtolower(
                        ($emp['full_name'] ?? '').' '.
                        ($emp['employee_code'] ?? '').' '.
                        ($emp['position']['title'] ?? '').' '.
                        ($emp['department']['name'] ?? '').' '.
                        ($emp['department']['code'] ?? '').' '.
                        ($item['recommendation_note'] ?? '')
                    );

                    return str_contains($haystack, $needle);
                });
            })
            ->sort(function (array $a, array $b) {
                if ($a['is_overridden'] !== $b['is_overridden']) {
                    return $a['is_overridden'] ? -1 : 1;
                }
                if ($a['final_score'] !== $b['final_score']) {
                    return $b['final_score'] <=> $a['final_score'];
                }

                return strcmp($a['employee']['employee_code'] ?? '', $b['employee']['employee_code'] ?? '');
            })
            ->values()
            ->all();

        $departments = Department::query()
            ->select(['id', 'code', 'name'])
            ->orderBy('name')
            ->get();

        $employees = $actor->role === 'employee'
            ? ($actor->employee
                ? collect([[
                    'id' => $actor->employee->id,
                    'employee_code' => $actor->employee->employee_code,
                    'full_name' => $actor->employee->full_name,
                    'department_id' => $actor->employee->department_id,
                ]])
                : collect())
            : Employee::query()
                ->where('status', 'active')
                ->select(['id', 'employee_code', 'full_name', 'department_id'])
                ->orderBy('full_name')
                ->get();

        return [
            'filters' => [
                'period_week' => $periodWeek,
                'period_month' => $periodMonth,
                'week_start' => $weekStart->toDateString(),
                'week_end' => $weekEnd->toDateString(),
                'department_id' => $departmentId,
                'employee_id' => $requestedEmployeeId,
                'risk_category' => $riskCategoryFilter,
                'is_overridden' => $overrideFilter,
                'search' => $search,
            ],
            'thresholds' => $this->getThresholds(),
            'workload_risks' => $filteredRows,
            'summary' => $summary,
            'departments' => $departments,
            'employees' => $employees,
        ];
    }

    /**
     * Load detailed Workload Risk diagnostics for a single stored record with RBAC guard.
     *
     * @return array<string, mixed>
     */
    public function find(WorkloadRisk $workloadRisk, UserAccount $actor): array
    {
        if ($actor->role === 'employee' && $workloadRisk->employee_id !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda hanya dapat mengakses analisis risiko beban kerja milik Anda sendiri.');
        }

        $workloadRisk->load(['employee.department', 'employee.position', 'employee.employmentType']);

        [, , $weekStart, $weekEnd] = $this->resolveWeekWindow($workloadRisk->period_week, $workloadRisk->period_month);
        $employee = $workloadRisk->employee;

        $weekLogs = WorkLog::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', '>=', $weekStart->toDateString())
            ->whereDate('work_date', '<=', $weekEnd->toDateString())
            ->with('taskAssignment.task:id,title')
            ->orderByDesc('work_date')
            ->get();

        $approvedOvertimes = Overtime::query()
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('overtime_date', '>=', $weekStart->toDateString())
            ->whereDate('overtime_date', '<=', $weekEnd->toDateString())
            ->orderByDesc('overtime_date')
            ->get();

        $approvedLeaves = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $weekEnd->toDateString())
            ->whereDate('end_date', '>=', $weekStart->toDateString())
            ->get();

        $activeAssignments = TaskAssignment::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->whereHas('task', fn ($tq) => $tq->where('status', '!=', 'cancelled'))
            ->with('task:id,title,estimated_hours,priority,due_date,status')
            ->orderBy('deadline')
            ->get();

        $diagnostics = $this->calculateEmployeeMetrics(
            $employee,
            $weekLogs,
            $approvedOvertimes,
            $approvedLeaves,
            $activeAssignments,
            $weekStart,
            $weekEnd
        );

        $payload = $this->formatRiskPayload($workloadRisk, $employee, $diagnostics);
        $payload['active_assignments'] = $activeAssignments->values()->all();
        $payload['week_work_logs'] = $weekLogs->values()->all();

        return $payload;
    }

    /**
     * Synchronize & persist `workload_risks` rows inside a DB transaction.
     *
     * @param  Collection<int, Employee>  $employees
     * @return Collection<int, array<string, mixed>>
     */
    private function syncEmployeesWorkloadRisks(
        Collection $employees,
        string $periodWeek,
        string $periodMonth,
        Carbon $weekStart,
        Carbon $weekEnd
    ): Collection {
        if ($employees->isEmpty()) {
            return collect();
        }

        $employeeIds = $employees->pluck('id')->all();

        $weekLogsByEmp = WorkLog::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('work_date', '>=', $weekStart->toDateString())
            ->whereDate('work_date', '<=', $weekEnd->toDateString())
            ->get()
            ->groupBy('employee_id');

        $approvedOvertimesByEmp = Overtime::query()
            ->whereIn('employee_id', $employeeIds)
            ->where('status', 'approved')
            ->whereDate('overtime_date', '>=', $weekStart->toDateString())
            ->whereDate('overtime_date', '<=', $weekEnd->toDateString())
            ->get()
            ->groupBy('employee_id');

        $approvedLeavesByEmp = LeaveRequest::query()
            ->whereIn('employee_id', $employeeIds)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $weekEnd->toDateString())
            ->whereDate('end_date', '>=', $weekStart->toDateString())
            ->get()
            ->groupBy('employee_id');

        $activeAssignmentsByEmp = TaskAssignment::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->whereHas('task', fn ($tq) => $tq->where('status', '!=', 'cancelled'))
            ->with('task:id,title,estimated_hours,priority,status')
            ->get()
            ->groupBy('employee_id');

        return DB::transaction(function () use (
            $employees,
            $weekLogsByEmp,
            $approvedOvertimesByEmp,
            $approvedLeavesByEmp,
            $activeAssignmentsByEmp,
            $periodWeek,
            $periodMonth,
            $weekStart,
            $weekEnd
        ) {
            return $employees->map(function (Employee $employee) use (
                $weekLogsByEmp,
                $approvedOvertimesByEmp,
                $approvedLeavesByEmp,
                $activeAssignmentsByEmp,
                $periodWeek,
                $periodMonth,
                $weekStart,
                $weekEnd
            ) {
                $diagnostics = $this->calculateEmployeeMetrics(
                    $employee,
                    $weekLogsByEmp->get($employee->id, collect()),
                    $approvedOvertimesByEmp->get($employee->id, collect()),
                    $approvedLeavesByEmp->get($employee->id, collect()),
                    $activeAssignmentsByEmp->get($employee->id, collect()),
                    $weekStart,
                    $weekEnd
                );

                $record = WorkloadRisk::updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'period_week' => $periodWeek,
                    ],
                    [
                        'period_month' => $periodMonth,
                        'weekly_hours_score' => $diagnostics['weekly_hours_score'],
                        'overtime_score' => $diagnostics['overtime_score'],
                        'task_load_score' => $diagnostics['task_load_score'],
                        'deadline_pressure_score' => $diagnostics['deadline_pressure_score'],
                        'final_score' => $diagnostics['final_score'],
                        'risk_category' => $diagnostics['risk_category'],
                        'is_overridden' => $diagnostics['is_overridden'],
                    ]
                );

                return $this->formatRiskPayload($record, $employee, $diagnostics);
            })->values();
        });
    }

    /**
     * Deterministic calculation engine enforcing PRD §4.1 & GEMINI.md traps 1-3 + PP 35/2021 override.
     *
     * @param  Collection<int, WorkLog>  $weekLogs
     * @param  Collection<int, Overtime>  $approvedOvertimes
     * @param  Collection<int, LeaveRequest>  $approvedLeaves
     * @param  Collection<int, TaskAssignment>  $activeAssignments
     * @return array<string, mixed>
     */
    private function calculateEmployeeMetrics(
        Employee $employee,
        Collection $weekLogs,
        Collection $approvedOvertimes,
        Collection $approvedLeaves,
        Collection $activeAssignments,
        Carbon $weekStart,
        Carbon $weekEnd
    ): array {
        $thresholds = $this->getThresholds();
        $weights = $thresholds['weights'];

        $safeHoursThreshold = (float) $thresholds['normal_weekly_hours_threshold'];
        $criticalHoursThreshold = (float) $thresholds['critical_weekly_hours_threshold'];
        $maxDailyOvertimeLimit = (float) $thresholds['max_daily_overtime_hours'];
        $maxWeeklyOvertimeLimit = (float) $thresholds['max_weekly_overtime_hours'];
        $safeLoadRatio = (float) $thresholds['task_load_safe_ratio'];
        $maxLoadRatio = (float) $thresholds['task_load_max_ratio'];
        $deadlineWindowDays = (int) $thresholds['deadline_window_days'];
        $mediumRiskThreshold = (float) $thresholds['medium_risk_threshold'];
        $highRiskThreshold = (float) $thresholds['high_risk_threshold'];

        $workDaysPerWeek = (int) ($employee->employmentType?->work_days_per_week ?? 5);
        $normalWeeklyHours = (float) ($employee->employmentType?->normal_weekly_hours ?? $safeHoursThreshold);
        $normalDailyHours = $workDaysPerWeek >= 6 ? 7.0 : 8.0;

        // 1. Weekly Hours Indicator (clamped [0, 100])
        $weeklyHoursTotal = round((float) $weekLogs->sum('hours_spent'), 2);
        $hoursDenominator = max(0.01, $criticalHoursThreshold - $safeHoursThreshold);
        $weeklyHoursScore = round(
            min(100.0, max(0.0, (($weeklyHoursTotal - $safeHoursThreshold) / $hoursDenominator) * 100.0)),
            2
        );

        // 2. Overtime Indicator (Trap 2: 5-day=8h / 6-day=7h; Trap 3: approved overtimes prioritized)
        $overtimeDaysCount = 0;
        $weeklyOvertimeHours = 0.0;
        $maxDailyOvertimeHours = 0.0;
        $overtimeSource = 'work_logs';

        if ($approvedOvertimes->isNotEmpty()) {
            $overtimeSource = 'approved_overtimes';
            $byDate = $approvedOvertimes->groupBy(fn (Overtime $ot) => $ot->overtime_date->format('Y-m-d'));
            foreach ($byDate as $dayItems) {
                $dayOt = round((float) $dayItems->sum('duration_hours'), 2);
                if ($dayOt > 0.0) {
                    $overtimeDaysCount++;
                    $weeklyOvertimeHours += $dayOt;
                    $maxDailyOvertimeHours = max($maxDailyOvertimeHours, $dayOt);
                }
            }
        } else {
            $logsByDate = $weekLogs->groupBy(fn (WorkLog $log) => $log->work_date->format('Y-m-d'));
            foreach ($logsByDate as $dayLogs) {
                $dayTotal = round((float) $dayLogs->sum('hours_spent'), 2);
                $dayOt = max(0.0, round($dayTotal - $normalDailyHours, 2));
                if ($dayOt > 0.0) {
                    $overtimeDaysCount++;
                    $weeklyOvertimeHours += $dayOt;
                    $maxDailyOvertimeHours = max($maxDailyOvertimeHours, $dayOt);
                }
            }
        }

        $weeklyOvertimeHours = round($weeklyOvertimeHours, 2);
        $maxDailyOvertimeHours = round($maxDailyOvertimeHours, 2);

        if ($maxDailyOvertimeHours > $maxDailyOvertimeLimit || $weeklyOvertimeHours > $maxWeeklyOvertimeLimit) {
            $overtimeScore = 100.0;
        } else {
            $overtimeRatio = $workDaysPerWeek > 0 ? ($overtimeDaysCount / $workDaysPerWeek) : 0.0;
            $overtimeScore = round(min(100.0, max(0.0, $overtimeRatio * 100.0)), 2);
        }

        // 3. Task Load Indicator with approved leave deduction & Trap 1 division-by-zero guard
        $approvedLeaveHours = 0.0;
        foreach ($approvedLeaves as $leave) {
            $leaveStart = $leave->start_date->copy()->startOfDay();
            $leaveEnd = $leave->end_date->copy()->startOfDay();
            $totalLeaveDays = max(1, $leaveStart->diffInDays($leaveEnd) + 1);

            $overlapStart = $leaveStart->greaterThan($weekStart) ? $leaveStart : $weekStart->copy()->startOfDay();
            $overlapEnd = $leaveEnd->lessThan($weekEnd) ? $leaveEnd : $weekEnd->copy()->startOfDay();

            if ($overlapStart->lessThanOrEqualTo($overlapEnd)) {
                $overlapDays = $overlapStart->diffInDays($overlapEnd) + 1;
                $approvedLeaveHours += ((float) $leave->total_hours) * ($overlapDays / $totalLeaveDays);
            }
        }
        $approvedLeaveHours = round($approvedLeaveHours, 2);

        $activeEstimatedHours = round(
            (float) $activeAssignments->sum(fn (TaskAssignment $a) => (float) ($a->task?->estimated_hours ?? 0)),
            2
        );

        $availableCapacityHours = round(max(0.0, $normalWeeklyHours - $approvedLeaveHours), 2);
        if ($availableCapacityHours <= 0.0) {
            $taskLoadScore = $activeEstimatedHours > 0.0 ? 100.0 : 0.0;
            $workloadRatio = null;
        } else {
            $workloadRatio = round($activeEstimatedHours / $availableCapacityHours, 2);
            $ratioDenominator = max(0.01, $maxLoadRatio - $safeLoadRatio);
            $taskLoadScore = round(
                min(100.0, max(0.0, (($workloadRatio - $safeLoadRatio) / $ratioDenominator) * 100.0)),
                2
            );
        }

        // 4. Deadline Pressure Indicator
        $today = now()->toDateString();
        $soonBoundary = now()->addDays($deadlineWindowDays)->toDateString();

        $activeCount = $activeAssignments->count();
        $overdueCount = $activeAssignments->filter(
            fn (TaskAssignment $a) => $a->deadline->format('Y-m-d') < $today
        )->count();
        $dueSoonCount = $activeAssignments->filter(function (TaskAssignment $a) use ($today, $soonBoundary) {
            $d = $a->deadline->format('Y-m-d');

            return $d >= $today && $d <= $soonBoundary;
        })->count();
        $urgentCount = $overdueCount + $dueSoonCount;

        $deadlinePressureScore = $activeCount > 0
            ? round(min(100.0, max(0.0, ($urgentCount / $activeCount) * 100.0)), 2)
            : 0.0;

        // Weighted Final Score
        $finalScore = round(
            ($weeklyHoursScore * (float) $weights['weekly_hours'])
            + ($overtimeScore * (float) $weights['overtime'])
            + ($taskLoadScore * (float) $weights['task_load'])
            + ($deadlinePressureScore * (float) $weights['deadline_pressure']),
            2
        );

        // Mandatory PP No. 35/2021 Override
        $overrideReasons = [];
        if ($weeklyHoursTotal >= $criticalHoursThreshold) {
            $overrideReasons[] = "Total jam kerja mingguan ({$weeklyHoursTotal}j) >= batas kritis {$criticalHoursThreshold} jam/minggu.";
        }
        if ($maxDailyOvertimeHours > $maxDailyOvertimeLimit) {
            $overrideReasons[] = "Lembur harian ({$maxDailyOvertimeHours}j) melampaui batas {$maxDailyOvertimeLimit} jam/hari (PP No. 35/2021).";
        }
        if ($weeklyOvertimeHours > $maxWeeklyOvertimeLimit) {
            $overrideReasons[] = "Lembur mingguan ({$weeklyOvertimeHours}j) melampaui batas {$maxWeeklyOvertimeLimit} jam/minggu (PP No. 35/2021).";
        }

        $isOverridden = $overrideReasons !== [];
        $riskCategory = ($isOverridden || $finalScore >= $highRiskThreshold)
            ? 'high'
            : ($finalScore >= $mediumRiskThreshold ? 'medium' : 'low');

        $recommendationNote = $this->resolveRecommendationNote(
            $isOverridden,
            $riskCategory,
            $taskLoadScore,
            $deadlinePressureScore,
            $overdueCount
        );

        return [
            'weekly_hours_score' => $weeklyHoursScore,
            'overtime_score' => $overtimeScore,
            'task_load_score' => $taskLoadScore,
            'deadline_pressure_score' => $deadlinePressureScore,
            'final_score' => $finalScore,
            'risk_category' => $riskCategory,
            'is_overridden' => $isOverridden,
            'override_reasons' => $overrideReasons,
            'recommendation_note' => $recommendationNote,
            'metrics' => [
                'weekly_hours_total' => $weeklyHoursTotal,
                'normal_weekly_hours' => $normalWeeklyHours,
                'normal_daily_hours' => $normalDailyHours,
                'work_days_per_week' => $workDaysPerWeek,
                'overtime_hours_total' => $weeklyOvertimeHours,
                'max_daily_overtime_hours' => $maxDailyOvertimeHours,
                'overtime_days_count' => $overtimeDaysCount,
                'overtime_source' => $overtimeSource,
                'approved_leave_hours' => $approvedLeaveHours,
                'available_capacity_hours' => $availableCapacityHours,
                'active_assignments_count' => $activeCount,
                'active_estimated_hours' => $activeEstimatedHours,
                'workload_ratio' => $workloadRatio,
                'overdue_assignments_count' => $overdueCount,
                'due_soon_assignments_count' => $dueSoonCount,
                'urgent_assignments_count' => $urgentCount,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $diagnostics
     * @return array<string, mixed>
     */
    private function formatRiskPayload(WorkloadRisk $record, Employee $employee, array $diagnostics): array
    {
        return [
            'id' => $record->id,
            'employee_id' => $record->employee_id,
            'period_week' => $record->period_week,
            'period_month' => $record->period_month,
            'weekly_hours_score' => (float) $record->weekly_hours_score,
            'overtime_score' => (float) $record->overtime_score,
            'task_load_score' => (float) $record->task_load_score,
            'deadline_pressure_score' => (float) $record->deadline_pressure_score,
            'final_score' => (float) $record->final_score,
            'risk_category' => $record->risk_category,
            'is_overridden' => (bool) $record->is_overridden,
            'override_reasons' => $diagnostics['override_reasons'],
            'recommendation_note' => $diagnostics['recommendation_note'],
            'metrics' => $diagnostics['metrics'],
            'employee' => [
                'id' => $employee->id,
                'employee_code' => $employee->employee_code,
                'full_name' => $employee->full_name,
                'department' => $employee->department ? [
                    'id' => $employee->department->id,
                    'code' => $employee->department->code,
                    'name' => $employee->department->name,
                ] : null,
                'position' => $employee->position ? [
                    'id' => $employee->position->id,
                    'title' => $employee->position->title,
                ] : null,
                'employment_type' => $employee->employmentType ? [
                    'id' => $employee->employmentType->id,
                    'name' => $employee->employmentType->name,
                    'work_days_per_week' => $employee->employmentType->work_days_per_week,
                    'normal_weekly_hours' => $employee->employmentType->normal_weekly_hours,
                ] : null,
            ],
            'created_at' => $record->created_at?->toIso8601String(),
            'updated_at' => $record->updated_at?->toIso8601String(),
        ];
    }

    private function resolveRecommendationNote(
        bool $isOverridden,
        string $riskCategory,
        float $taskLoadScore,
        float $deadlinePressureScore,
        int $overdueCount
    ): string {
        if ($isOverridden) {
            return 'Beban Tinggi (Override PP No. 35/2021). Disarankan redistribusi tugas segera dan pemulihan waktu istirahat.';
        }

        if ($riskCategory === 'high') {
            return 'Beban Tinggi. Perlu redistribusi tugas atau penjadwalan ulang tenggat prioritas bersama manajer.';
        }

        if ($riskCategory === 'medium') {
            if ($overdueCount > 0) {
                return 'Perlu Perhatian. Terdapat penugasan melewati tenggat waktu; tinjau kapasitas dan prioritas mingguan.';
            }
            if ($taskLoadScore >= 50.0 || $deadlinePressureScore >= 75.0) {
                return 'Perlu Perhatian. Estimasi jam tugas dan tenggat cukup padat; hindari penambahan tugas baru sementara.';
            }

            return 'Perlu Perhatian. Indikator beban kerja berada pada kategori sedang; lakukan pemantauan berkala.';
        }

        return 'Beban Seimbang. Proporsi jam kerja, kapasitas cuti, dan tenggat tugas berada dalam ambang sehat.';
    }

    /**
     * @return array{0: string, 1: string, 2: Carbon, 3: Carbon}
     */
    private function resolveWeekWindow(?string $requestedWeek, ?string $requestedMonth): array
    {
        if ($requestedWeek !== null && preg_match('/^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/', trim($requestedWeek), $matches)) {
            $weekStart = Carbon::now()->setISODate((int) $matches[1], (int) $matches[2])->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();
            $periodMonth = $requestedMonth !== null && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', trim($requestedMonth))
                ? trim($requestedMonth)
                : $weekEnd->format('Y-m');

            return [$weekStart->format('o-\WW'), $periodMonth, $weekStart, $weekEnd];
        }

        if ($requestedMonth !== null && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', trim($requestedMonth))) {
            $monthTrimmed = trim($requestedMonth);
            if ($monthTrimmed === now()->format('Y-m')) {
                $weekStart = now()->startOfWeek();
            } else {
                $weekStart = Carbon::createFromFormat('Y-m', $monthTrimmed)->endOfMonth()->startOfWeek();
            }
            $weekEnd = $weekStart->copy()->endOfWeek();

            return [$weekStart->format('o-\WW'), $monthTrimmed, $weekStart, $weekEnd];
        }

        $weekStart = now()->startOfWeek();
        $weekEnd = $weekStart->copy()->endOfWeek();

        return [$weekStart->format('o-\WW'), $weekEnd->format('Y-m'), $weekStart, $weekEnd];
    }
}
