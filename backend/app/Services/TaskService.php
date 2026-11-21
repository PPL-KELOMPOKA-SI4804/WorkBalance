<?php

namespace App\Services;

use App\Models\Task;
use App\Models\UserAccount;
use App\Models\WorkLog;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TaskService
{
    /**
     * Retrieve filtered tasks alongside summary metrics for planning and workload risk monitoring.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters = []): array
    {
        $today = now()->toDateString();
        $soonBoundary = now()->addDays(7)->toDateString();

        $query = Task::query()
            ->with(['department', 'creator.position'])
            ->withCount('assignments');

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('department', function ($dq) use ($search) {
                        $dq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('creator', fn ($cq) => $cq->where('full_name', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (! empty($filters['priority']) && in_array($filters['priority'], ['low', 'medium', 'high', 'critical'], true)) {
            $query->where('priority', $filters['priority']);
        }

        if (! empty($filters['status']) && in_array($filters['status'], ['open', 'in_progress', 'completed', 'cancelled'], true)) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['due_filter'])) {
            if ($filters['due_filter'] === 'overdue') {
                $query->whereIn('status', ['open', 'in_progress'])
                    ->whereDate('due_date', '<', $today);
            } elseif ($filters['due_filter'] === 'due_soon') {
                $query->whereIn('status', ['open', 'in_progress'])
                    ->whereDate('due_date', '>=', $today)
                    ->whereDate('due_date', '<=', $soonBoundary);
            }
        }

        $tasks = $query
            ->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            ->orderBy('due_date')
            ->orderByDesc('id')
            ->get();

        $total = Task::count();
        $active = Task::whereIn('status', ['open', 'in_progress'])->count();
        $completed = Task::where('status', 'completed')->count();
        $totalActiveEstimatedHours = round(
            (float) Task::whereIn('status', ['open', 'in_progress'])->sum('estimated_hours'),
            2
        );
        $deadlinePressureCount = Task::whereIn('status', ['open', 'in_progress'])
            ->whereDate('due_date', '<=', $soonBoundary)
            ->count();

        return [
            'tasks' => $tasks,
            'summary' => [
                'total' => $total,
                'active' => $active,
                'completed' => $completed,
                'total_active_estimated_hours' => $totalActiveEstimatedHours,
                'deadline_pressure_count' => $deadlinePressureCount,
            ],
        ];
    }

    /**
     * Load complete details of a single task including department, creator, and assignments.
     */
    public function find(Task $task): Task
    {
        return $task
            ->load(['department', 'creator.position', 'assignments.employee.position'])
            ->loadCount('assignments');
    }

    /**
     * Create a new task inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, UserAccount $actor): Task
    {
        return DB::transaction(function () use ($data, $actor) {
            $createdBy = ! empty($data['created_by'])
                ? (int) $data['created_by']
                : $actor->employee?->id;

            if (! $createdBy) {
                throw new ConflictHttpException('Akun pengguna belum terhubung dengan profil pegawai sehingga tidak dapat membuat tugas.');
            }

            $description = isset($data['description']) ? trim((string) $data['description']) : null;

            $task = Task::create([
                'department_id' => (int) $data['department_id'],
                'created_by' => $createdBy,
                'title' => trim((string) $data['title']),
                'description' => $description === '' ? null : $description,
                'estimated_hours' => round((float) $data['estimated_hours'], 2),
                'priority' => $data['priority'],
                'due_date' => $data['due_date'],
                'status' => $data['status'] ?? 'open',
            ]);

            return $task
                ->load(['department', 'creator.position'])
                ->loadCount('assignments');
        });
    }

    /**
     * Update an existing task inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Task $task, array $data): Task
    {
        return DB::transaction(function () use ($task, $data) {
            $fields = [];

            if (array_key_exists('department_id', $data)) {
                $fields['department_id'] = (int) $data['department_id'];
            }

            if (array_key_exists('title', $data)) {
                $fields['title'] = trim((string) $data['title']);
            }

            if (array_key_exists('description', $data)) {
                $description = $data['description'] !== null ? trim((string) $data['description']) : null;
                $fields['description'] = $description === '' ? null : $description;
            }

            if (array_key_exists('estimated_hours', $data)) {
                $fields['estimated_hours'] = round((float) $data['estimated_hours'], 2);
            }

            if (array_key_exists('priority', $data)) {
                $fields['priority'] = $data['priority'];
            }

            if (array_key_exists('due_date', $data)) {
                $fields['due_date'] = $data['due_date'];
            }

            if (array_key_exists('status', $data)) {
                $fields['status'] = $data['status'];
            }

            if ($fields !== []) {
                $task->update($fields);
            }

            return $task
                ->fresh(['department', 'creator.position'])
                ->loadCount('assignments');
        });
    }

    /**
     * Delete a task unless it has active/completed assignments or recorded work logs.
     */
    public function delete(Task $task): void
    {
        $hasWorkLogs = WorkLog::whereIn('task_assignment_id', $task->assignments()->select('id'))->exists();
        $hasActiveOrCompletedAssignments = $task->assignments()
            ->whereIn('status', ['in_progress', 'completed'])
            ->exists();

        if ($hasWorkLogs || $hasActiveOrCompletedAssignments) {
            throw new ConflictHttpException('Tugas tidak dapat dihapus karena sudah memiliki penugasan aktif atau riwayat work log.');
        }

        DB::transaction(function () use ($task) {
            $task->delete();
        });
    }
}
