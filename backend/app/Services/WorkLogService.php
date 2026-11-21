<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use App\Models\WorkLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class WorkLogService
{
    /**
     * Retrieve filtered work logs, estimation vs realization comparison per assignment,
     * and summary metrics scoped by actor role.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        $query = WorkLog::query()->with([
            'employee.department',
            'employee.position',
            'employee.employmentType',
            'taskAssignment.task.department',
        ]);

        $summaryBase = WorkLog::query();
        $assignmentBase = TaskAssignment::query()
            ->with(['task.department', 'employee.department', 'employee.position'])
            ->withCount('workLogs')
            ->withSum('workLogs as actual_hours_sum', 'hours_spent');

        $summaryAssignmentBase = TaskAssignment::query()
            ->with('task:id,estimated_hours')
            ->withSum('workLogs as actual_hours_sum', 'hours_spent');

        if ($actor->role === 'employee') {
            $employeeId = $actor->employee?->id ?? 0;
            $query->where('employee_id', $employeeId);
            $summaryBase->where('employee_id', $employeeId);
            $assignmentBase->where('employee_id', $employeeId);
            $summaryAssignmentBase->where('employee_id', $employeeId);
        } else {
            if (! empty($filters['employee_id'])) {
                $targetEmployeeId = (int) $filters['employee_id'];
                $query->where('employee_id', $targetEmployeeId);
                $assignmentBase->where('employee_id', $targetEmployeeId);
            }

            if (! empty($filters['department_id'])) {
                $departmentId = (int) $filters['department_id'];
                $query->where(function ($q) use ($departmentId) {
                    $q->whereHas('employee', fn ($eq) => $eq->where('department_id', $departmentId))
                        ->orWhereHas('taskAssignment.task', fn ($tq) => $tq->where('department_id', $departmentId));
                });
                $assignmentBase->where(function ($q) use ($departmentId) {
                    $q->whereHas('employee', fn ($eq) => $eq->where('department_id', $departmentId))
                        ->orWhereHas('task', fn ($tq) => $tq->where('department_id', $departmentId));
                });
            }
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('activity_description', 'like', "%{$search}%")
                    ->orWhereHas('taskAssignment.task', fn ($tq) => $tq->where('title', 'like', "%{$search}%"))
                    ->orWhereHas('employee', function ($eq) use ($search) {
                        $eq->where('full_name', 'like', "%{$search}%")
                            ->orWhere('employee_code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('employee.department', function ($dq) use ($search) {
                        $dq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($filters['task_assignment_id'])) {
            $query->where('task_assignment_id', (int) $filters['task_assignment_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('work_date', '>=', trim((string) $filters['date_from']));
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('work_date', '<=', trim((string) $filters['date_to']));
        }

        $workLogs = $query
            ->orderByDesc('work_date')
            ->orderByDesc('id')
            ->get();

        // Compute actor-scoped daily totals & overtime days using employment_types.work_days_per_week
        $summaryLogs = (clone $summaryBase)
            ->with('employee.employmentType')
            ->get(['id', 'employee_id', 'work_date', 'hours_spent']);

        $dailyTotals = [];
        $overtimeDaysCount = 0;

        foreach ($summaryLogs->groupBy(fn (WorkLog $log) => $log->employee_id.'|'.$log->work_date->format('Y-m-d')) as $key => $group) {
            $sumHours = round((float) $group->sum('hours_spent'), 2);
            $workDays = (int) ($group->first()->employee?->employmentType?->work_days_per_week ?? 5);
            $dailyLimit = $workDays >= 6 ? 7.0 : 8.0;

            $dailyTotals[$key] = [
                'total_hours' => $sumHours,
                'limit_hours' => $dailyLimit,
            ];

            if ($sumHours > $dailyLimit) {
                $overtimeDaysCount++;
            }
        }

        $workLogs->each(function (WorkLog $log) use ($dailyTotals) {
            $key = $log->employee_id.'|'.$log->work_date->format('Y-m-d');
            $dailyInfo = $dailyTotals[$key] ?? ['total_hours' => (float) $log->hours_spent, 'limit_hours' => 8.0];
            $log->setAttribute('daily_total_hours', $dailyInfo['total_hours']);
            $log->setAttribute('daily_limit_hours', $dailyInfo['limit_hours']);
        });

        // Format task assignments with estimated vs actual comparison
        $assignments = $assignmentBase
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 1 WHEN 'assigned' THEN 2 ELSE 3 END")
            ->orderBy('deadline')
            ->get()
            ->map(function (TaskAssignment $assignment) {
                $estimatedHours = round((float) ($assignment->task?->estimated_hours ?? 0), 2);
                $actualHours = round((float) ($assignment->actual_hours_sum ?? 0), 2);
                $varianceHours = round($actualHours - $estimatedHours, 2);
                $realizationRate = $estimatedHours > 0
                    ? round(($actualHours / $estimatedHours) * 100, 1)
                    : 0.0;

                return [
                    'id' => $assignment->id,
                    'task_id' => $assignment->task_id,
                    'employee_id' => $assignment->employee_id,
                    'deadline' => $assignment->deadline?->format('Y-m-d'),
                    'status' => $assignment->status,
                    'work_logs_count' => (int) ($assignment->work_logs_count ?? 0),
                    'estimated_hours' => $estimatedHours,
                    'actual_hours' => $actualHours,
                    'variance_hours' => $varianceHours,
                    'realization_rate' => $realizationRate,
                    'task' => $assignment->task,
                    'employee' => $assignment->employee,
                ];
            })
            ->values();

        // Compute actor-scoped summary metrics
        $totalLogs = $summaryLogs->count();
        $totalHoursSpent = round((float) $summaryLogs->sum('hours_spent'), 2);

        $weekStart = now()->startOfWeek()->toDateString();
        $weekEnd = now()->endOfWeek()->toDateString();
        $currentWeekHours = round((float) $summaryLogs->filter(function (WorkLog $log) use ($weekStart, $weekEnd) {
            $date = $log->work_date->format('Y-m-d');

            return $date >= $weekStart && $date <= $weekEnd;
        })->sum('hours_spent'), 2);

        $summaryAssignments = $summaryAssignmentBase->get();
        $totalEstimatedHours = round(
            (float) $summaryAssignments->sum(fn (TaskAssignment $item) => (float) ($item->task?->estimated_hours ?? 0)),
            2
        );
        $totalLinkedActualHours = round(
            (float) $summaryAssignments->sum(fn (TaskAssignment $item) => (float) ($item->actual_hours_sum ?? 0)),
            2
        );
        $overallRealizationRate = $totalEstimatedHours > 0
            ? round(($totalLinkedActualHours / $totalEstimatedHours) * 100, 1)
            : 0.0;

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
            'work_logs' => $workLogs,
            'assignments' => $assignments,
            'departments' => $departments,
            'employees' => $employees,
            'summary' => [
                'total_logs' => $totalLogs,
                'total_hours_spent' => $totalHoursSpent,
                'current_week_hours' => $currentWeekHours,
                'total_estimated_hours' => $totalEstimatedHours,
                'total_linked_actual_hours' => $totalLinkedActualHours,
                'overall_realization_rate' => $overallRealizationRate,
                'overtime_days_count' => $overtimeDaysCount,
            ],
        ];
    }

    /**
     * Find a single work log with ownership isolation for employees.
     */
    public function find(WorkLog $workLog, UserAccount $actor): WorkLog
    {
        if ($actor->role === 'employee' && $workLog->employee_id !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda hanya dapat mengakses catatan work log milik Anda sendiri.');
        }

        return $workLog->load([
            'employee.department',
            'employee.position',
            'employee.employmentType',
            'taskAssignment.task.department',
        ]);
    }

    /**
     * Record a new work log entry inside a transaction with domain checks.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, UserAccount $actor): WorkLog
    {
        $employee = $actor->role === 'admin' && ! empty($data['employee_id'])
            ? Employee::findOrFail((int) $data['employee_id'])
            : $actor->employee;

        if (! $employee || $employee->status !== 'active') {
            throw new ConflictHttpException('Hanya pegawai aktif yang terhubung dengan profil pegawai yang dapat mencatat work log.');
        }

        $assignment = null;
        if (! empty($data['task_assignment_id'])) {
            $assignment = TaskAssignment::with('task')->findOrFail((int) $data['task_assignment_id']);
            $this->guardAssignmentOwnershipAndStatus($assignment, $employee, $actor);
        }

        $workDate = Carbon::parse((string) $data['work_date'])->toDateString();
        $hoursSpent = round((float) $data['hours_spent'], 2);

        $this->guardDailyHoursLimit($employee->id, $workDate, $hoursSpent);

        $workLog = DB::transaction(function () use ($data, $employee, $assignment, $workDate, $hoursSpent) {
            $created = WorkLog::create([
                'employee_id' => $employee->id,
                'task_assignment_id' => $assignment?->id,
                'work_date' => $workDate,
                'hours_spent' => $hoursSpent,
                'activity_description' => trim((string) $data['activity_description']),
            ]);

            if ($assignment && $assignment->status === 'assigned') {
                $assignment->update(['status' => 'in_progress']);
                if ($assignment->task && $assignment->task->status === 'open') {
                    $assignment->task->update(['status' => 'in_progress']);
                }
            }

            return $created;
        });

        return $workLog->load([
            'employee.department',
            'employee.position',
            'employee.employmentType',
            'taskAssignment.task.department',
        ]);
    }

    /**
     * Update an existing work log entry inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(WorkLog $workLog, array $data, UserAccount $actor): WorkLog
    {
        if ($actor->role === 'employee' && $workLog->employee_id !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda tidak memiliki akses untuk mengubah work log milik pegawai lain.');
        }

        $employee = $workLog->employee;
        if (! $employee || $employee->status !== 'active') {
            throw new ConflictHttpException('Hanya pegawai aktif yang dapat memperbarui catatan work log.');
        }

        $assignment = null;
        if (array_key_exists('task_assignment_id', $data)) {
            if ($data['task_assignment_id'] !== null) {
                $assignment = TaskAssignment::with('task')->findOrFail((int) $data['task_assignment_id']);
                $this->guardAssignmentOwnershipAndStatus($assignment, $employee, $actor);
            }
        } elseif ($workLog->task_assignment_id !== null) {
            $assignment = TaskAssignment::with('task')->find($workLog->task_assignment_id);
        }

        $targetDate = array_key_exists('work_date', $data)
            ? Carbon::parse((string) $data['work_date'])->toDateString()
            : $workLog->work_date->format('Y-m-d');

        $targetHours = array_key_exists('hours_spent', $data)
            ? round((float) $data['hours_spent'], 2)
            : round((float) $workLog->hours_spent, 2);

        $this->guardDailyHoursLimit($employee->id, $targetDate, $targetHours, $workLog->id);

        DB::transaction(function () use ($workLog, $data, $assignment, $targetDate, $targetHours) {
            $fields = [];

            if (array_key_exists('task_assignment_id', $data)) {
                $fields['task_assignment_id'] = $assignment?->id;
            }

            if (array_key_exists('work_date', $data)) {
                $fields['work_date'] = $targetDate;
            }

            if (array_key_exists('hours_spent', $data)) {
                $fields['hours_spent'] = $targetHours;
            }

            if (array_key_exists('activity_description', $data)) {
                $fields['activity_description'] = trim((string) $data['activity_description']);
            }

            if ($fields !== []) {
                $workLog->update($fields);
            }

            if ($assignment && $assignment->status === 'assigned') {
                $assignment->update(['status' => 'in_progress']);
                if ($assignment->task && $assignment->task->status === 'open') {
                    $assignment->task->update(['status' => 'in_progress']);
                }
            }
        });

        return $workLog->fresh([
            'employee.department',
            'employee.position',
            'employee.employmentType',
            'taskAssignment.task.department',
        ]);
    }

    /**
     * Delete a work log entry inside a transaction with ownership guard.
     */
    public function delete(WorkLog $workLog, UserAccount $actor): void
    {
        if ($actor->role === 'employee' && $workLog->employee_id !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda tidak memiliki akses untuk menghapus work log milik pegawai lain.');
        }

        DB::transaction(function () use ($workLog) {
            $workLog->delete();
        });
    }

    private function guardAssignmentOwnershipAndStatus(
        TaskAssignment $assignment,
        Employee $employee,
        UserAccount $actor
    ): void {
        if ($assignment->employee_id !== $employee->id) {
            if ($actor->role === 'employee') {
                throw new AccessDeniedHttpException('Anda hanya dapat mencatat work log pada penugasan milik Anda sendiri.');
            }

            throw new ConflictHttpException('Penugasan tugas tidak sesuai dengan pegawai yang dipilih.');
        }

        if ($assignment->task && $assignment->task->status === 'cancelled') {
            throw new ConflictHttpException('Tidak dapat mencatat work log pada tugas yang berstatus dibatalkan.');
        }
    }

    private function guardDailyHoursLimit(
        int $employeeId,
        string $workDate,
        float $newHours,
        ?int $ignoreWorkLogId = null
    ): void {
        $query = WorkLog::query()
            ->where('employee_id', $employeeId)
            ->whereDate('work_date', $workDate);

        if ($ignoreWorkLogId !== null) {
            $query->where('id', '!=', $ignoreWorkLogId);
        }

        $existingHours = (float) $query->sum('hours_spent');

        if (round($existingHours + $newHours, 2) > 24.0) {
            throw new ConflictHttpException('Total jam kerja aktual pada tanggal tersebut melebihi batas 24 jam per hari.');
        }
    }
}
