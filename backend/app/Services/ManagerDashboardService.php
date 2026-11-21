<?php

namespace App\Services;

use App\Models\Compensation;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeCompetency;
use App\Models\LeaveRequest;
use App\Models\Overtime;
use App\Models\SafetyIncident;
use App\Models\SurveyResponse;
use App\Models\TaskAssignment;
use App\Models\TrainingParticipation;
use App\Models\UserAccount;
use App\Models\WorkLog;
use App\Models\WorkplaceIssue;
use App\Models\WorkSurvey;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ManagerDashboardService
{
    /**
     * Build the team condition, workload risk, decent work dimensions, and workplace issues summary.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function getSummary(array $filters, UserAccount $actor): array
    {
        $departmentId = ! empty($filters['department_id']) ? (int) $filters['department_id'] : null;
        $search = trim((string) ($filters['search'] ?? ''));

        $periodMonth = $this->resolvePeriodMonth($filters['period_month'] ?? null);
        [$periodWeek, $weekStart, $weekEnd] = $this->resolveWeekWindow(
            $filters['period_week'] ?? null,
            $periodMonth
        );

        $today = now()->toDateString();
        $soonBoundary = now()->addDays(7)->toDateString();

        $allDepartments = Department::query()
            ->withCount(['employees as active_employees_count' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('name')
            ->get();

        $activeEmployeesQuery = Employee::query()
            ->where('status', 'active')
            ->with(['department', 'position', 'employmentType']);

        if ($departmentId !== null) {
            $activeEmployeesQuery->where('department_id', $departmentId);
        }

        $scopedEmployees = $activeEmployeesQuery->orderBy('full_name')->get();
        $scopedEmployeeIds = $scopedEmployees->pluck('id')->all();

        $weekLogsByEmp = WorkLog::query()
            ->whereIn('employee_id', $scopedEmployeeIds)
            ->whereDate('work_date', '>=', $weekStart->toDateString())
            ->whereDate('work_date', '<=', $weekEnd->toDateString())
            ->get()
            ->groupBy('employee_id');

        $approvedOvertimesByEmp = Overtime::query()
            ->whereIn('employee_id', $scopedEmployeeIds)
            ->where('status', 'approved')
            ->whereDate('overtime_date', '>=', $weekStart->toDateString())
            ->whereDate('overtime_date', '<=', $weekEnd->toDateString())
            ->get()
            ->groupBy('employee_id');

        $approvedLeavesByEmp = LeaveRequest::query()
            ->whereIn('employee_id', $scopedEmployeeIds)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $weekEnd->toDateString())
            ->whereDate('end_date', '>=', $weekStart->toDateString())
            ->get()
            ->groupBy('employee_id');

        $activeAssignmentsByEmp = TaskAssignment::query()
            ->whereIn('employee_id', $scopedEmployeeIds)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->with('task:id,title,estimated_hours,priority,status')
            ->get()
            ->groupBy('employee_id');

        // Calculate live Workload Risk breakdown per active employee
        $employeePrioritiesAll = $scopedEmployees->map(function (Employee $employee) use (
            $weekLogsByEmp,
            $approvedOvertimesByEmp,
            $approvedLeavesByEmp,
            $activeAssignmentsByEmp,
            $weekStart,
            $weekEnd,
            $today,
            $soonBoundary
        ) {
            return $this->computeEmployeeRisk(
                $employee,
                $weekLogsByEmp->get($employee->id, collect()),
                $approvedOvertimesByEmp->get($employee->id, collect()),
                $approvedLeavesByEmp->get($employee->id, collect()),
                $activeAssignmentsByEmp->get($employee->id, collect()),
                $weekStart,
                $weekEnd,
                $today,
                $soonBoundary
            );
        })->values();

        // Filter employee priorities by search if provided
        $employeePriorities = $employeePrioritiesAll
            ->when($search !== '', function (Collection $items) use ($search) {
                $needle = mb_strtolower($search);

                return $items->filter(function (array $item) use ($needle) {
                    $haystack = mb_strtolower(
                        ($item['full_name'] ?? '').' '.
                        ($item['employee_code'] ?? '').' '.
                        ($item['position_title'] ?? '').' '.
                        ($item['department']['name'] ?? '').' '.
                        ($item['department']['code'] ?? '').' '.
                        ($item['priority_reason'] ?? '')
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
                if ($a['overdue_assignments_count'] !== $b['overdue_assignments_count']) {
                    return $b['overdue_assignments_count'] <=> $a['overdue_assignments_count'];
                }

                return strcmp($a['full_name'], $b['full_name']);
            })
            ->values();

        // Workplace Issues Summary (FR-13)
        $issuesQuery = WorkplaceIssue::query()
            ->with(['reporter.position', 'department']);

        if ($departmentId !== null) {
            $issuesQuery->where('department_id', $departmentId);
        }

        $allScopedIssues = $issuesQuery
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get();

        $totalIssues = $allScopedIssues->count();
        $openIssues = $allScopedIssues->where('status', 'open')->count();
        $inProgressIssues = $allScopedIssues->where('status', 'in_progress')->count();
        $resolvedIssues = $allScopedIssues->where('status', 'resolved')->count();
        $issueResolutionRate = $totalIssues > 0 ? round(($resolvedIssues / $totalIssues) * 100, 1) : 100.0;

        $issuesByCategory = $allScopedIssues
            ->groupBy('category')
            ->map(fn (Collection $group, string $category) => [
                'category' => $category,
                'total' => $group->count(),
                'open' => $group->where('status', 'open')->count(),
                'in_progress' => $group->where('status', 'in_progress')->count(),
                'resolved' => $group->where('status', 'resolved')->count(),
            ])
            ->sortByDesc('total')
            ->values()
            ->all();

        $activeIssues = $allScopedIssues
            ->whereIn('status', ['open', 'in_progress'])
            ->when($search !== '', function (Collection $items) use ($search) {
                $needle = mb_strtolower($search);

                return $items->filter(function (WorkplaceIssue $issue) use ($needle) {
                    $haystack = mb_strtolower(
                        $issue->category.' '.
                        $issue->description.' '.
                        ($issue->department?->name ?? '').' '.
                        ($issue->reporter?->full_name ?? '')
                    );

                    return str_contains($haystack, $needle);
                });
            })
            ->take(10)
            ->map(fn (WorkplaceIssue $issue) => [
                'id' => $issue->id,
                'category' => $issue->category,
                'description' => $issue->description,
                'status' => $issue->status,
                'resolution_notes' => $issue->resolution_notes,
                'created_at' => $issue->created_at?->toIso8601String(),
                'department' => $issue->department ? [
                    'id' => $issue->department->id,
                    'code' => $issue->department->code,
                    'name' => $issue->department->name,
                ] : null,
                'reporter' => $issue->reporter ? [
                    'id' => $issue->reporter->id,
                    'employee_code' => $issue->reporter->employee_code,
                    'full_name' => $issue->reporter->full_name,
                    'position_title' => $issue->reporter->position?->title,
                ] : null,
            ])
            ->values()
            ->all();

        // NFR-02 Strict Survey Aggregation (zero individual comments or IDs exposed)
        $targetSurvey = WorkSurvey::query()
            ->where('period_month', $periodMonth)
            ->orderByDesc('is_active')
            ->orderByDesc('id')
            ->first();

        $surveyAggregate = $this->computeSurveyAggregate(
            $targetSurvey,
            $periodMonth,
            $scopedEmployeeIds,
            count($scopedEmployeeIds)
        );

        // Decent Work Score 6 Dimensions for selected scope
        $decentWorkResult = $this->computeDecentWorkDimensions(
            $scopedEmployeeIds,
            $employeePrioritiesAll,
            $periodMonth,
            $departmentId,
            $surveyAggregate,
            $totalIssues,
            $resolvedIssues
        );

        // Per-department comparison rows (all departments or filtered department)
        $departmentsToCompare = $departmentId !== null
            ? $allDepartments->where('id', $departmentId)->values()
            : $allDepartments;

        $departmentComparison = $this->buildDepartmentComparison(
            $departmentsToCompare,
            $periodMonth,
            $targetSurvey,
            $weekStart,
            $weekEnd,
            $today,
            $soonBoundary
        );

        // Aggregate KPI Summary
        $empCount = $employeePrioritiesAll->count();
        $avgWorkloadRisk = $empCount > 0
            ? round((float) $employeePrioritiesAll->avg('final_score'), 2)
            : 0.0;

        $highRiskCount = $employeePrioritiesAll->where('risk_category', 'high')->count();
        $mediumRiskCount = $employeePrioritiesAll->where('risk_category', 'medium')->count();
        $lowRiskCount = $employeePrioritiesAll->where('risk_category', 'low')->count();
        $overriddenCount = $employeePrioritiesAll->where('is_overridden', true)->count();

        $workloadRiskCategory = $avgWorkloadRisk >= 70.0 || $overriddenCount > 0
            ? 'high'
            : ($avgWorkloadRisk >= 40.0 ? 'medium' : 'low');

        $kpiSummary = [
            'active_employees_count' => $empCount,
            'avg_workload_risk_score' => $avgWorkloadRisk,
            'workload_risk_category' => $workloadRiskCategory,
            'high_risk_employees_count' => $highRiskCount,
            'medium_risk_employees_count' => $mediumRiskCount,
            'low_risk_employees_count' => $lowRiskCount,
            'overridden_employees_count' => $overriddenCount,
            'decent_work_score' => $decentWorkResult['final_score'],
            'decent_work_category' => $decentWorkResult['status_category'],
            'open_issues_count' => $openIssues,
            'in_progress_issues_count' => $inProgressIssues,
            'resolved_issues_count' => $resolvedIssues,
            'total_issues_count' => $totalIssues,
            'issue_resolution_rate' => $issueResolutionRate,
            'active_assignments_count' => (int) $employeePrioritiesAll->sum('active_assignments_count'),
            'urgent_assignments_count' => (int) $employeePrioritiesAll->sum('urgent_assignments_count'),
            'overdue_assignments_count' => (int) $employeePrioritiesAll->sum('overdue_assignments_count'),
            'weekly_logged_hours_total' => round((float) $employeePrioritiesAll->sum('weekly_hours_total'), 2),
            'active_estimated_hours_total' => round((float) $employeePrioritiesAll->sum('active_estimated_hours'), 2),
        ];

        $priorityHighlights = $this->buildPriorityHighlights(
            $kpiSummary,
            $employeePrioritiesAll,
            $decentWorkResult['dimensions'],
            $allScopedIssues
        );

        return [
            'filters' => [
                'department_id' => $departmentId,
                'period_month' => $periodMonth,
                'period_week' => $periodWeek,
                'week_start' => $weekStart->toDateString(),
                'week_end' => $weekEnd->toDateString(),
                'search' => $search,
            ],
            'departments' => $allDepartments->map(fn (Department $dept) => [
                'id' => $dept->id,
                'code' => $dept->code,
                'name' => $dept->name,
                'active_employees_count' => (int) ($dept->active_employees_count ?? 0),
            ])->values()->all(),
            'kpi_summary' => $kpiSummary,
            'decent_work_dimensions' => $decentWorkResult['dimensions'],
            'department_comparison' => $departmentComparison,
            'employee_priorities' => $employeePriorities->all(),
            'workplace_issues_summary' => [
                'counts' => [
                    'total' => $totalIssues,
                    'open' => $openIssues,
                    'in_progress' => $inProgressIssues,
                    'resolved' => $resolvedIssues,
                    'resolution_rate' => $issueResolutionRate,
                ],
                'by_category' => $issuesByCategory,
                'active_issues' => $activeIssues,
            ],
            'survey_wellbeing_summary' => $surveyAggregate,
            'priority_highlights' => $priorityHighlights,
        ];
    }

    private function resolvePeriodMonth(?string $requestedMonth): string
    {
        if ($requestedMonth !== null && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', trim($requestedMonth))) {
            return trim($requestedMonth);
        }

        $activeSurveyMonth = WorkSurvey::query()
            ->where('is_active', true)
            ->orderByDesc('period_month')
            ->value('period_month');

        if ($activeSurveyMonth) {
            return (string) $activeSurveyMonth;
        }

        return now()->format('Y-m');
    }

    /**
     * @return array{0: string, 1: Carbon, 2: Carbon}
     */
    private function resolveWeekWindow(?string $requestedWeek, string $periodMonth): array
    {
        if ($requestedWeek !== null && preg_match('/^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/', trim($requestedWeek), $matches)) {
            $start = Carbon::now()->setISODate((int) $matches[1], (int) $matches[2])->startOfWeek();

            return [$start->format('o-\WW'), $start, $start->copy()->endOfWeek()];
        }

        if ($periodMonth === now()->format('Y-m')) {
            $start = now()->startOfWeek();

            return [$start->format('o-\WW'), $start, $start->copy()->endOfWeek()];
        }

        $monthEnd = Carbon::createFromFormat('Y-m', $periodMonth)->endOfMonth();
        $start = $monthEnd->copy()->startOfWeek();

        return [$start->format('o-\WW'), $start, $start->copy()->endOfWeek()];
    }

    /**
     * Compute 4-indicator Workload Risk & PP No. 35/2021 override status for an active employee.
     *
     * @param  Collection<int, WorkLog>  $weekLogs
     * @param  Collection<int, Overtime>  $approvedOvertimes
     * @param  Collection<int, LeaveRequest>  $approvedLeaves
     * @param  Collection<int, TaskAssignment>  $activeAssignments
     * @return array<string, mixed>
     */
    private function computeEmployeeRisk(
        Employee $employee,
        Collection $weekLogs,
        Collection $approvedOvertimes,
        Collection $approvedLeaves,
        Collection $activeAssignments,
        Carbon $weekStart,
        Carbon $weekEnd,
        string $today,
        string $soonBoundary
    ): array {
        $workDaysPerWeek = (int) ($employee->employmentType?->work_days_per_week ?? 5);
        $normalWeeklyHours = (float) ($employee->employmentType?->normal_weekly_hours ?? 40);
        $normalDailyHours = $workDaysPerWeek >= 6 ? 7.0 : 8.0;

        // 1. Weekly Hours Indicator (40h -> 0, 55h -> 100)
        $weeklyHoursTotal = round((float) $weekLogs->sum('hours_spent'), 2);
        $weeklyHoursScore = round(min(100.0, max(0.0, (($weeklyHoursTotal - 40.0) / 15.0) * 100.0)), 2);

        // 2. Overtime Indicator (prioritize approved overtimes; fallback to work_logs > daily normal)
        $overtimeDaysCount = 0;
        $weeklyOvertimeHours = 0.0;
        $maxDailyOvertimeHours = 0.0;
        $overtimeSource = 'work_logs';

        if ($approvedOvertimes->isNotEmpty()) {
            $overtimeSource = 'approved_overtimes';
            $overtimeByDate = $approvedOvertimes->groupBy(fn (Overtime $ot) => $ot->overtime_date->format('Y-m-d'));
            foreach ($overtimeByDate as $dayItems) {
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

        if ($maxDailyOvertimeHours > 4.0 || $weeklyOvertimeHours > 18.0) {
            $overtimeScore = 100.0;
        } else {
            $overtimeRatio = $workDaysPerWeek > 0 ? ($overtimeDaysCount / $workDaysPerWeek) : 0.0;
            $overtimeScore = round(min(100.0, max(0.0, $overtimeRatio * 100.0)), 2);
        }

        // 3. Task Load Indicator with approved leave capacity deduction & zero-division guard
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
            (float) $activeAssignments->sum(fn (TaskAssignment $assign) => (float) ($assign->task?->estimated_hours ?? 0)),
            2
        );

        $availableCapacityHours = round(max(0.0, $normalWeeklyHours - $approvedLeaveHours), 2);
        if ($availableCapacityHours <= 0.0) {
            $taskLoadScore = $activeEstimatedHours > 0.0 ? 100.0 : 0.0;
            $workloadRatio = null;
        } else {
            $workloadRatio = round($activeEstimatedHours / $availableCapacityHours, 2);
            $taskLoadScore = round(min(100.0, max(0.0, (($workloadRatio - 1.0) / 0.5) * 100.0)), 2);
        }

        // 4. Deadline Pressure Indicator (active tasks due <= 7 days or overdue)
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

        // Composite Weighted Average (25% each) & PP No. 35/2021 Mandatory Override
        $arithmeticAverage = round(
            ($weeklyHoursScore + $overtimeScore + $taskLoadScore + $deadlinePressureScore) / 4.0,
            2
        );
        $isOverridden = $weeklyHoursTotal >= 55.0
            || $maxDailyOvertimeHours > 4.0
            || $weeklyOvertimeHours > 18.0;

        $riskCategory = ($isOverridden || $arithmeticAverage >= 70.0)
            ? 'high'
            : ($arithmeticAverage >= 40.0 ? 'medium' : 'low');

        $priorityReason = $this->resolvePriorityReason(
            $isOverridden,
            $riskCategory,
            $weeklyHoursTotal,
            $weeklyOvertimeHours,
            $maxDailyOvertimeHours,
            $taskLoadScore,
            $overdueCount,
            $urgentCount
        );

        return [
            'employee_id' => $employee->id,
            'employee_code' => $employee->employee_code,
            'full_name' => $employee->full_name,
            'position_title' => $employee->position?->title,
            'department' => $employee->department ? [
                'id' => $employee->department->id,
                'code' => $employee->department->code,
                'name' => $employee->department->name,
            ] : null,
            'work_days_per_week' => $workDaysPerWeek,
            'normal_weekly_hours' => $normalWeeklyHours,
            'approved_leave_hours' => $approvedLeaveHours,
            'available_capacity_hours' => $availableCapacityHours,
            'weekly_hours_total' => $weeklyHoursTotal,
            'overtime_hours_total' => $weeklyOvertimeHours,
            'max_daily_overtime_hours' => $maxDailyOvertimeHours,
            'overtime_days_count' => $overtimeDaysCount,
            'overtime_source' => $overtimeSource,
            'active_assignments_count' => $activeCount,
            'active_estimated_hours' => $activeEstimatedHours,
            'workload_ratio' => $workloadRatio,
            'overdue_assignments_count' => $overdueCount,
            'due_soon_assignments_count' => $dueSoonCount,
            'urgent_assignments_count' => $urgentCount,
            'weekly_hours_score' => $weeklyHoursScore,
            'overtime_score' => $overtimeScore,
            'task_load_score' => $taskLoadScore,
            'deadline_pressure_score' => $deadlinePressureScore,
            'final_score' => $arithmeticAverage,
            'risk_category' => $riskCategory,
            'is_overridden' => $isOverridden,
            'priority_reason' => $priorityReason,
        ];
    }

    private function resolvePriorityReason(
        bool $isOverridden,
        string $riskCategory,
        float $weeklyHours,
        float $weeklyOvertime,
        float $maxDailyOvertime,
        float $taskLoadScore,
        int $overdueCount,
        int $urgentCount
    ): string {
        if ($isOverridden) {
            if ($weeklyHours >= 55.0) {
                return 'Jam kerja minggu ini >= 55 jam (Override PP No. 35/2021). Perlu redistribusi tugas segera.';
            }
            if ($maxDailyOvertime > 4.0) {
                return 'Lembur harian melebihi 4 jam (Override PP No. 35/2021). Perlu penyesuaian beban kerja.';
            }

            return 'Akumulasi lembur mingguan melebihi 18 jam (Override PP No. 35/2021). Perlu pemulihan beban.';
        }

        if ($riskCategory === 'high') {
            return 'Kombinasi beban tugas dan tekanan tenggat tinggi. Perlu peninjauan prioritas.';
        }

        if ($overdueCount > 0) {
            return "{$overdueCount} penugasan melewati tenggat waktu. Disarankan sinkronisasi prioritas.";
        }

        if ($taskLoadScore >= 50.0) {
            return 'Estimasi jam tugas aktif melebihi kapasitas mingguan. Pantau progres berkala.';
        }

        if ($urgentCount > 0) {
            return "{$urgentCount} penugasan aktif jatuh tempo dalam 7 hari ke depan.";
        }

        if ($riskCategory === 'medium') {
            return 'Indikator beban kerja kategori sedang. Lanjutkan pemantauan rutin.';
        }

        return 'Beban kerja dan waktu kerja berada dalam batas seimbang.';
    }

    /**
     * Compute purely aggregated survey metrics (NFR-02 compliant: no individual IDs or comments).
     *
     * @param  array<int, int>  $scopedEmployeeIds
     * @return array<string, mixed>
     */
    private function computeSurveyAggregate(
        ?WorkSurvey $targetSurvey,
        string $periodMonth,
        array $scopedEmployeeIds,
        int $activeEmployeesCount
    ): array {
        $surveyIds = WorkSurvey::query()
            ->where('period_month', $periodMonth)
            ->pluck('id')
            ->all();

        if ($surveyIds === [] || $scopedEmployeeIds === []) {
            return [
                'survey_id' => $targetSurvey?->id,
                'survey_title' => $targetSurvey?->title,
                'period_month' => $periodMonth,
                'respondents_count' => 0,
                'active_employees_count' => $activeEmployeesCount,
                'participation_rate' => 0.0,
                'avg_wlb_score' => null,
                'avg_workload_perception_score' => null,
                'converted_wlb_dimension_score' => 0.0,
            ];
        }

        $stats = SurveyResponse::query()
            ->whereIn('work_survey_id', $surveyIds)
            ->whereIn('employee_id', $scopedEmployeeIds)
            ->selectRaw('COUNT(DISTINCT employee_id) as respondents_count, AVG(work_life_balance_score) as avg_wlb, AVG(workload_perception_score) as avg_workload')
            ->first();

        $respondentsCount = (int) ($stats->respondents_count ?? 0);
        $avgWlb = $respondentsCount > 0 ? round((float) $stats->avg_wlb, 2) : null;
        $avgWorkload = $respondentsCount > 0 ? round((float) $stats->avg_workload, 2) : null;
        $convertedWlbDim = $avgWlb !== null ? round((($avgWlb - 1.0) / 4.0) * 100.0, 2) : 0.0;
        $participationRate = $activeEmployeesCount > 0
            ? round(min(100.0, ($respondentsCount / $activeEmployeesCount) * 100.0), 1)
            : 0.0;

        return [
            'survey_id' => $targetSurvey?->id,
            'survey_title' => $targetSurvey?->title,
            'period_month' => $periodMonth,
            'respondents_count' => $respondentsCount,
            'active_employees_count' => $activeEmployeesCount,
            'participation_rate' => $participationRate,
            'avg_wlb_score' => $avgWlb,
            'avg_workload_perception_score' => $avgWorkload,
            'converted_wlb_dimension_score' => $convertedWlbDim,
        ];
    }

    /**
     * Compute all 6 Decent Work Score dimensions and composite score per PRD §4.2.
     *
     * @param  array<int, int>  $scopedEmployeeIds
     * @param  Collection<int, array<string, mixed>>  $employeePriorities
     * @param  array<string, mixed>  $surveyAggregate
     * @return array<string, mixed>
     */
    private function computeDecentWorkDimensions(
        array $scopedEmployeeIds,
        Collection $employeePriorities,
        string $periodMonth,
        ?int $departmentId,
        array $surveyAggregate,
        int $totalIssues,
        int $resolvedIssues
    ): array {
        $empCount = count($scopedEmployeeIds);

        // Dim 1: Waktu Kerja & Beban = 100 - Avg(Workload Risk)
        $avgRisk = $employeePriorities->isNotEmpty() ? (float) $employeePriorities->avg('final_score') : 0.0;
        $dimWorkload = round(min(100.0, max(0.0, 100.0 - $avgRisk)), 2);

        // Dim 2: Keseimbangan Kehidupan & Kerja = ((Avg WLB - 1) / 4) * 100
        $dimWlb = round(min(100.0, max(0.0, (float) ($surveyAggregate['converted_wlb_dimension_score'] ?? 0.0))), 2);

        // Dim 3: Kelengkapan Kompensasi = % pegawai aktif dengan data kompensasi lengkap pada period_month
        $compCompleteEmployees = ($empCount > 0)
            ? Compensation::query()
                ->where('period_month', $periodMonth)
                ->where('is_complete', true)
                ->whereIn('employee_id', $scopedEmployeeIds)
                ->distinct('employee_id')
                ->count('employee_id')
            : 0;
        $dimCompensation = $empCount > 0 ? round(($compCompleteEmployees / $empCount) * 100.0, 2) : 0.0;

        // Dim 4: Keselamatan Kerja = rata-rata max(0, 100 - 50 * insiden berat) & % insiden resolved (100% jika 0)
        $incidentsQuery = SafetyIncident::query()
            ->where('incident_date', 'like', "{$periodMonth}%");
        if ($departmentId !== null) {
            $incidentsQuery->where('department_id', $departmentId);
        }
        $incidents = $incidentsQuery->get();
        $totalIncidents = $incidents->count();
        $severeIncidents = $incidents->where('severity', 'severe')->count();
        $resolvedIncidents = $incidents->where('status', 'resolved')->count();

        $safetySeveritySub = max(0.0, 100.0 - (50.0 * $severeIncidents));
        $safetyResolutionSub = $totalIncidents > 0 ? (($resolvedIncidents / $totalIncidents) * 100.0) : 100.0;
        $dimSafety = round(($safetySeveritySub + $safetyResolutionSub) / 2.0, 2);

        // Dim 5: Suara Pekerja = rata-rata % masalah kerja tertangani (100% jika 0) & % partisipasi survei
        $issueResolutionPct = $totalIssues > 0 ? (($resolvedIssues / $totalIssues) * 100.0) : 100.0;
        $surveyParticipationPct = (float) ($surveyAggregate['participation_rate'] ?? 0.0);
        $dimVoice = round(($issueResolutionPct + $surveyParticipationPct) / 2.0, 2);

        // Dim 6: Pengembangan Kompetensi = rata-rata % pegawai ikut >= 1 pelatihan & % kompetensi capai target
        $trainedEmployeesCount = $empCount > 0
            ? TrainingParticipation::query()
                ->whereIn('employee_id', $scopedEmployeeIds)
                ->whereIn('status', ['enrolled', 'completed'])
                ->distinct('employee_id')
                ->count('employee_id')
            : 0;
        $trainingCoveragePct = $empCount > 0 ? (($trainedEmployeesCount / $empCount) * 100.0) : 0.0;

        $competencies = $empCount > 0
            ? EmployeeCompetency::query()->whereIn('employee_id', $scopedEmployeeIds)->get(['current_level', 'target_level'])
            : collect();
        $totalCompetencies = $competencies->count();
        $metTargetCompetencies = $competencies->filter(fn ($c) => $c->current_level >= $c->target_level)->count();
        $competencyTargetPct = $totalCompetencies > 0 ? (($metTargetCompetencies / $totalCompetencies) * 100.0) : 0.0;
        $dimCompetency = round(($trainingCoveragePct + $competencyTargetPct) / 2.0, 2);

        $dimensions = [
            [
                'key' => 'workload',
                'label' => '1. Waktu Kerja & Beban',
                'score' => $dimWorkload,
                'status_category' => $this->categorizeDecentWork($dimWorkload),
                'description' => '100 dikurangi rata-rata skor Workload Risk pegawai.',
            ],
            [
                'key' => 'wlb',
                'label' => '2. Keseimbangan Kerja-Hidup',
                'score' => $dimWlb,
                'status_category' => $this->categorizeDecentWork($dimWlb),
                'description' => $surveyAggregate['avg_wlb_score'] !== null
                    ? "Skor WLB survei agregat {$surveyAggregate['avg_wlb_score']} / 5."
                    : 'Menunggu pengisian survei periode berjalan.',
            ],
            [
                'key' => 'compensation',
                'label' => '3. Kelengkapan Kompensasi',
                'score' => $dimCompensation,
                'status_category' => $this->categorizeDecentWork($dimCompensation),
                'description' => "{$compCompleteEmployees} dari {$empCount} pegawai memiliki catatan kompensasi lengkap.",
            ],
            [
                'key' => 'safety',
                'label' => '4. Keselamatan Kerja (K3)',
                'score' => $dimSafety,
                'status_category' => $this->categorizeDecentWork($dimSafety),
                'description' => $totalIncidents === 0
                    ? '0 insiden keselamatan tercatat pada periode ini.'
                    : "{$resolvedIncidents} dari {$totalIncidents} insiden selesai ditangani.",
            ],
            [
                'key' => 'voice',
                'label' => '5. Suara Pekerja',
                'score' => $dimVoice,
                'status_category' => $this->categorizeDecentWork($dimVoice),
                'description' => 'Rasio penyelesaian isu ('.round($issueResolutionPct, 1).'%) & partisipasi survei ('.round($surveyParticipationPct, 1).'%).',
            ],
            [
                'key' => 'competency',
                'label' => '6. Pengembangan Kompetensi',
                'score' => $dimCompetency,
                'status_category' => $this->categorizeDecentWork($dimCompetency),
                'description' => "{$trainedEmployeesCount} dari {$empCount} pegawai mengikuti pelatihan; {$metTargetCompetencies}/{$totalCompetencies} target kompetensi.",
            ],
        ];

        $finalScore = round(collect($dimensions)->avg('score') ?? 0.0, 2);

        return [
            'final_score' => $finalScore,
            'status_category' => $this->categorizeDecentWork($finalScore),
            'dimensions' => $dimensions,
        ];
    }

    /**
     * Build per-department metric comparison table/bars.
     *
     * @param  Collection<int, Department>  $departments
     * @return array<int, array<string, mixed>>
     */
    private function buildDepartmentComparison(
        Collection $departments,
        string $periodMonth,
        ?WorkSurvey $targetSurvey,
        Carbon $weekStart,
        Carbon $weekEnd,
        string $today,
        string $soonBoundary
    ): array {
        return $departments->map(function (Department $dept) use (
            $periodMonth,
            $targetSurvey,
            $weekStart,
            $weekEnd,
            $today,
            $soonBoundary
        ) {
            $deptEmployees = Employee::query()
                ->where('department_id', $dept->id)
                ->where('status', 'active')
                ->with(['department', 'position', 'employmentType'])
                ->get();

            $deptEmployeeIds = $deptEmployees->pluck('id')->all();

            $weekLogs = WorkLog::query()
                ->whereIn('employee_id', $deptEmployeeIds)
                ->whereDate('work_date', '>=', $weekStart->toDateString())
                ->whereDate('work_date', '<=', $weekEnd->toDateString())
                ->get()
                ->groupBy('employee_id');

            $overtimes = Overtime::query()
                ->whereIn('employee_id', $deptEmployeeIds)
                ->where('status', 'approved')
                ->whereDate('overtime_date', '>=', $weekStart->toDateString())
                ->whereDate('overtime_date', '<=', $weekEnd->toDateString())
                ->get()
                ->groupBy('employee_id');

            $leaves = LeaveRequest::query()
                ->whereIn('employee_id', $deptEmployeeIds)
                ->where('status', 'approved')
                ->whereDate('start_date', '<=', $weekEnd->toDateString())
                ->whereDate('end_date', '>=', $weekStart->toDateString())
                ->get()
                ->groupBy('employee_id');

            $assignments = TaskAssignment::query()
                ->whereIn('employee_id', $deptEmployeeIds)
                ->whereIn('status', ['assigned', 'in_progress'])
                ->with('task:id,estimated_hours')
                ->get()
                ->groupBy('employee_id');

            $risks = $deptEmployees->map(fn (Employee $emp) => $this->computeEmployeeRisk(
                $emp,
                $weekLogs->get($emp->id, collect()),
                $overtimes->get($emp->id, collect()),
                $leaves->get($emp->id, collect()),
                $assignments->get($emp->id, collect()),
                $weekStart,
                $weekEnd,
                $today,
                $soonBoundary
            ));

            $deptIssues = WorkplaceIssue::where('department_id', $dept->id)->get(['status']);
            $deptTotalIssues = $deptIssues->count();
            $deptOpenIssues = $deptIssues->where('status', 'open')->count();
            $deptInProgressIssues = $deptIssues->where('status', 'in_progress')->count();
            $deptResolvedIssues = $deptIssues->where('status', 'resolved')->count();

            $deptSurvey = $this->computeSurveyAggregate(
                $targetSurvey,
                $periodMonth,
                $deptEmployeeIds,
                count($deptEmployeeIds)
            );

            $deptDecent = $this->computeDecentWorkDimensions(
                $deptEmployeeIds,
                $risks,
                $periodMonth,
                $dept->id,
                $deptSurvey,
                $deptTotalIssues,
                $deptResolvedIssues
            );

            $avgRisk = $risks->isNotEmpty() ? round((float) $risks->avg('final_score'), 2) : 0.0;

            return [
                'department_id' => $dept->id,
                'code' => $dept->code,
                'name' => $dept->name,
                'active_employees_count' => $deptEmployees->count(),
                'avg_workload_risk_score' => $avgRisk,
                'high_risk_count' => $risks->where('risk_category', 'high')->count(),
                'medium_risk_count' => $risks->where('risk_category', 'medium')->count(),
                'low_risk_count' => $risks->where('risk_category', 'low')->count(),
                'weekly_hours_total' => round((float) $risks->sum('weekly_hours_total'), 2),
                'estimated_hours_total' => round((float) $risks->sum('active_estimated_hours'), 2),
                'open_issues_count' => $deptOpenIssues,
                'in_progress_issues_count' => $deptInProgressIssues,
                'resolved_issues_count' => $deptResolvedIssues,
                'survey_avg_wlb' => $deptSurvey['avg_wlb_score'],
                'survey_participation_rate' => $deptSurvey['participation_rate'],
                'decent_work_score' => $deptDecent['final_score'],
                'status_category' => $deptDecent['status_category'],
            ];
        })->values()->all();
    }

    /**
     * Rule-based actionable management highlights derived strictly from threshold indicators.
     *
     * @param  array<string, mixed>  $kpiSummary
     * @param  Collection<int, array<string, mixed>>  $employeePriorities
     * @param  array<int, array<string, mixed>>  $dimensions
     * @param  Collection<int, WorkplaceIssue>  $issues
     * @return array<int, array<string, mixed>>
     */
    private function buildPriorityHighlights(
        array $kpiSummary,
        Collection $employeePriorities,
        array $dimensions,
        Collection $issues
    ): array {
        $highlights = [];

        if (($kpiSummary['high_risk_employees_count'] ?? 0) > 0) {
            $topRiskNames = $employeePriorities
                ->where('risk_category', 'high')
                ->take(3)
                ->pluck('full_name')
                ->implode(', ');

            $highlights[] = [
                'id' => 'workload-high',
                'severity' => 'high',
                'title' => "{$kpiSummary['high_risk_employees_count']} Pegawai pada Kategori Beban Risiko Tinggi",
                'description' => "Perlu peninjauan beban & redistribusi tugas untuk: {$topRiskNames}.",
                'action_label' => 'Kelola Penugasan',
                'action_route' => '/manager/task-assignments',
            ];
        }

        if (($kpiSummary['overdue_assignments_count'] ?? 0) > 0) {
            $highlights[] = [
                'id' => 'deadline-overdue',
                'severity' => 'medium',
                'title' => "{$kpiSummary['overdue_assignments_count']} Penugasan Melewati Tenggat Waktu",
                'description' => 'Sinkronisasikan tenggat atau evaluasi estimasi jam bersama tim terkait.',
                'action_label' => 'Tinjau Penugasan',
                'action_route' => '/manager/task-assignments',
            ];
        }

        $waitingIssues = $issues->whereIn('status', ['open', 'in_progress'])->count();
        if ($waitingIssues > 0) {
            $openCount = $issues->where('status', 'open')->count();
            $highlights[] = [
                'id' => 'workplace-issues',
                'severity' => $openCount > 0 ? 'medium' : 'info',
                'title' => "{$waitingIssues} Laporan Permasalahan Kerja Aktif ({$openCount} Menunggu)",
                'description' => 'Tindak lanjut masalah kerja meningkatkan dimensi Suara Pekerja secara langsung.',
                'action_label' => 'Tindak Lanjuti Isu',
                'action_route' => '/manager/workplace-issues',
            ];
        }

        $lowestDim = collect($dimensions)->sortBy('score')->first();
        if ($lowestDim && $lowestDim['score'] < 75.0) {
            $highlights[] = [
                'id' => 'lowest-dimension',
                'severity' => $lowestDim['score'] < 50.0 ? 'high' : 'info',
                'title' => "Dimensi Terendah: {$lowestDim['label']} ({$lowestDim['score']}/100)",
                'description' => $lowestDim['description'],
                'action_label' => 'Lihat Survei & Tim',
                'action_route' => '/manager/surveys',
            ];
        }

        if ($highlights === []) {
            $highlights[] = [
                'id' => 'all-balanced',
                'severity' => 'low',
                'title' => 'Kondisi Beban Kerja & Suara Pekerja Terpantau Seimbang',
                'description' => 'Tidak ada pelanggaran ambang batas PP No. 35/2021 maupun permasalahan menunggu.',
                'action_label' => 'Pantau Work Log',
                'action_route' => '/manager/work-logs',
            ];
        }

        return $highlights;
    }

    private function categorizeDecentWork(float $score): string
    {
        if ($score >= 75.0) {
            return 'good';
        }

        if ($score >= 50.0) {
            return 'needs_attention';
        }

        return 'action_priority';
    }
}
