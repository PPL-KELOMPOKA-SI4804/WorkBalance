<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TaskAssignmentService
{
    /**
     * Retrieve filtered task assignments and summary workload metrics scoped by actor role.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        $today = now()->toDateString();
        $soonBoundary = now()->addDays(7)->toDateString();

        $query = TaskAssignment::query()
            ->with(['task.department', 'employee.department', 'employee.position', 'assigner.position'])
            ->withCount('workLogs');

        if ($actor->role === 'employee') {
            $query->where('employee_id', $actor->employee?->id ?? 0);
        } elseif (! empty($filters['employee_id'])) {
            $query->where('employee_id', (int) $filters['employee_id']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('task', fn ($tq) => $tq->where('title', 'like', "%{$search}%"))
                    ->orWhereHas('employee', function ($eq) use ($search) {
                        $eq->where('full_name', 'like', "%{$search}%")
                            ->orWhere('employee_code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('assigner', fn ($aq) => $aq->where('full_name', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['task_id'])) {
            $query->where('task_id', (int) $filters['task_id']);
        }

        if (! empty($filters['department_id'])) {
            $departmentId = (int) $filters['department_id'];
            $query->where(function ($q) use ($departmentId) {
                $q->whereHas('employee', fn ($eq) => $eq->where('department_id', $departmentId))
                    ->orWhereHas('task', fn ($tq) => $tq->where('department_id', $departmentId));
            });
        }

        if (! empty($filters['status']) && in_array($filters['status'], ['assigned', 'in_progress', 'completed'], true)) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['deadline_filter'])) {
            if ($filters['deadline_filter'] === 'overdue') {
                $query->whereIn('status', ['assigned', 'in_progress'])
                    ->whereDate('deadline', '<', $today);
            } elseif ($filters['deadline_filter'] === 'due_soon') {
                $query->whereIn('status', ['assigned', 'in_progress'])
                    ->whereDate('deadline', '>=', $today)
                    ->whereDate('deadline', '<=', $soonBoundary);
            }
        }

        $assignments = $query
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 1 WHEN 'assigned' THEN 2 ELSE 3 END")
            ->orderBy('deadline')
            ->orderByDesc('id')
            ->get();

        $summaryBase = TaskAssignment::query();
        if ($actor->role === 'employee') {
            $summaryBase->where('employee_id', $actor->employee?->id ?? 0);
        }

        $total = (clone $summaryBase)->count();
        $active = (clone $summaryBase)->whereIn('status', ['assigned', 'in_progress'])->count();
        $completed = (clone $summaryBase)->where('status', 'completed')->count();
        $deadlinePressureCount = (clone $summaryBase)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->whereDate('deadline', '<=', $soonBoundary)
            ->count();

        $activeAssignmentsForSum = (clone $summaryBase)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->with('task:id,estimated_hours')
            ->get(['id', 'task_id', 'employee_id']);

        $totalActiveAssignedHours = round(
            (float) $activeAssignmentsForSum->sum(fn ($item) => (float) ($item->task?->estimated_hours ?? 0)),
            2
        );

        $overloadedEmployeesCount = $activeAssignmentsForSum
            ->groupBy('employee_id')
            ->filter(fn ($group) => $group->sum(fn ($item) => (float) ($item->task?->estimated_hours ?? 0)) > 40.0)
            ->count();

        return [
            'assignments' => $assignments,
            'summary' => [
                'total' => $total,
                'active' => $active,
                'completed' => $completed,
                'total_active_assigned_hours' => $totalActiveAssignedHours,
                'deadline_pressure_count' => $deadlinePressureCount,
                'overloaded_employees_count' => $overloadedEmployeesCount,
            ],
        ];
    }

    /**
     * Load complete details of a task assignment with ownership guard for employees.
     */
    public function find(TaskAssignment $assignment, UserAccount $actor): TaskAssignment
    {
        if ($actor->role === 'employee' && $assignment->employee_id !== $actor->employee?->id) {
            throw new AccessDeniedHttpException('Anda tidak memiliki izin untuk melihat penugasan pegawai lain.');
        }

        return $assignment
            ->load([
                'task.department',
                'employee.department',
                'employee.position',
                'employee.employmentType',
                'assigner.position',
                'workLogs',
            ])
            ->loadCount('workLogs');
    }

    /**
     * Create a new task assignment inside a transaction with domain integrity checks.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, UserAccount $actor): TaskAssignment
    {
        return DB::transaction(function () use ($data, $actor) {
            $assignedBy = ! empty($data['assigned_by'])
                ? (int) $data['assigned_by']
                : $actor->employee?->id;

            if (! $assignedBy) {
                throw new ConflictHttpException('Akun pengguna belum terhubung dengan profil pegawai sehingga tidak dapat menetapkan penugasan.');
            }

            $task = Task::findOrFail((int) $data['task_id']);
            $employee = Employee::findOrFail((int) $data['employee_id']);

            $this->guardAssignmentTargets($task, $employee);

            $status = $data['status'] ?? 'assigned';

            $assignment = TaskAssignment::create([
                'task_id' => $task->id,
                'employee_id' => $employee->id,
                'assigned_by' => $assignedBy,
                'assigned_at' => $data['assigned_at'] ?? now(),
                'deadline' => $data['deadline'],
                'status' => $status,
            ]);

            if ($status === 'in_progress' && $task->status === 'open') {
                $task->update(['status' => 'in_progress']);
            }

            return $assignment
                ->load(['task.department', 'employee.department', 'employee.position', 'assigner.position'])
                ->loadCount('workLogs');
        });
    }

    /**
     * Update an existing task assignment inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(TaskAssignment $assignment, array $data): TaskAssignment
    {
        return DB::transaction(function () use ($assignment, $data) {
            $newTaskId = array_key_exists('task_id', $data) ? (int) $data['task_id'] : $assignment->task_id;
            $newEmployeeId = array_key_exists('employee_id', $data) ? (int) $data['employee_id'] : $assignment->employee_id;

            if ($newTaskId !== $assignment->task_id || $newEmployeeId !== $assignment->employee_id) {
                $task = Task::findOrFail($newTaskId);
                $employee = Employee::findOrFail($newEmployeeId);
                $this->guardAssignmentTargets($task, $employee, $assignment->id);
            }

            $fields = [];

            if (array_key_exists('task_id', $data)) {
                $fields['task_id'] = $newTaskId;
            }

            if (array_key_exists('employee_id', $data)) {
                $fields['employee_id'] = $newEmployeeId;
            }

            if (array_key_exists('deadline', $data)) {
                $fields['deadline'] = $data['deadline'];
            }

            if (array_key_exists('status', $data)) {
                $fields['status'] = $data['status'];
            }

            if (array_key_exists('assigned_at', $data) && ! empty($data['assigned_at'])) {
                $fields['assigned_at'] = $data['assigned_at'];
            }

            if ($fields !== []) {
                $assignment->update($fields);
            }

            $parentTask = $assignment->task()->first();
            if ($assignment->status === 'in_progress' && $parentTask && $parentTask->status === 'open') {
                $parentTask->update(['status' => 'in_progress']);
            }

            return $assignment
                ->fresh(['task.department', 'employee.department', 'employee.position', 'assigner.position'])
                ->loadCount('workLogs');
        });
    }

    /**
     * Delete a task assignment unless it is completed or has recorded work logs.
     */
    public function delete(TaskAssignment $assignment): void
    {
        if ($assignment->status === 'completed' || $assignment->workLogs()->exists()) {
            throw new ConflictHttpException('Penugasan tidak dapat dihapus karena sudah selesai atau memiliki riwayat work log.');
        }

        DB::transaction(function () use ($assignment) {
            $assignment->delete();
        });
    }

    /**
     * Validate business constraints on assignment target employee and task.
     */
    private function guardAssignmentTargets(Task $task, Employee $employee, ?int $ignoreAssignmentId = null): void
    {
        if ($employee->status !== 'active') {
            throw new ConflictHttpException('Tidak dapat menugaskan pekerjaan kepada pegawai berstatus nonaktif.');
        }

        if ($task->status === 'cancelled') {
            throw new ConflictHttpException('Tidak dapat menugaskan tugas yang berstatus dibatalkan.');
        }

        $duplicateQuery = TaskAssignment::query()
            ->where('task_id', $task->id)
            ->where('employee_id', $employee->id);

        if ($ignoreAssignmentId !== null) {
            $duplicateQuery->where('id', '!=', $ignoreAssignmentId);
        }

        if ($duplicateQuery->exists()) {
            throw new ConflictHttpException('Tugas ini sudah ditugaskan kepada pegawai tersebut.');
        }
    }
}
