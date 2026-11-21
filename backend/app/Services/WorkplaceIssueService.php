<?php

namespace App\Services;

use App\Models\Department;
use App\Models\UserAccount;
use App\Models\WorkplaceIssue;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class WorkplaceIssueService
{
    /**
     * Retrieve filtered workplace issues and summary metrics scoped by actor role.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        $query = WorkplaceIssue::query()
            ->with(['reporter.position', 'reporter.department', 'department']);

        $summaryBase = WorkplaceIssue::query();

        if ($actor->role === 'employee') {
            $employeeId = $actor->employee?->id ?? 0;
            $query->where('reported_by', $employeeId);
            $summaryBase->where('reported_by', $employeeId);
        } elseif (! empty($filters['reported_by'])) {
            $query->where('reported_by', (int) $filters['reported_by']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('category', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('resolution_notes', 'like', "%{$search}%")
                    ->orWhereHas('department', function ($dq) use ($search) {
                        $dq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('reporter', function ($rq) use ($search) {
                        $rq->where('full_name', 'like', "%{$search}%")
                            ->orWhere('employee_code', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (! empty($filters['category'])) {
            $query->where('category', trim((string) $filters['category']));
        }

        if (! empty($filters['status']) && in_array($filters['status'], ['open', 'in_progress', 'resolved'], true)) {
            $query->where('status', $filters['status']);
        }

        $issues = $query
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $categories = (clone $summaryBase)
            ->select('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->values()
            ->all();

        $departments = Department::query()
            ->select(['id', 'code', 'name'])
            ->orderBy('name')
            ->get();

        $total = (clone $summaryBase)->count();
        $open = (clone $summaryBase)->where('status', 'open')->count();
        $inProgress = (clone $summaryBase)->where('status', 'in_progress')->count();
        $resolved = (clone $summaryBase)->where('status', 'resolved')->count();
        $resolutionRate = $total > 0 ? round(($resolved / $total) * 100, 1) : 0.0;

        return [
            'issues' => $issues,
            'categories' => $categories,
            'departments' => $departments,
            'summary' => [
                'total' => $total,
                'open' => $open,
                'in_progress' => $inProgress,
                'resolved' => $resolved,
                'resolution_rate' => $resolutionRate,
            ],
        ];
    }

    /**
     * Find a single workplace issue with role-based ownership check.
     */
    public function find(WorkplaceIssue $issue, UserAccount $actor): WorkplaceIssue
    {
        if ($actor->role === 'employee' && $issue->reported_by !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda hanya dapat mengakses laporan permasalahan milik Anda sendiri.');
        }

        return $issue->load(['reporter.position', 'reporter.department', 'department']);
    }

    /**
     * Submit a new workplace issue inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, UserAccount $actor): WorkplaceIssue
    {
        $employee = $actor->employee;

        if (! $employee || $employee->status !== 'active') {
            throw new ConflictHttpException('Hanya pegawai aktif yang terhubung dengan profil pegawai yang dapat membuat laporan permasalahan.');
        }

        $departmentId = ! empty($data['department_id'])
            ? (int) $data['department_id']
            : $employee->department_id;

        $issue = DB::transaction(function () use ($data, $employee, $departmentId) {
            return WorkplaceIssue::create([
                'reported_by' => $employee->id,
                'department_id' => $departmentId,
                'category' => trim((string) $data['category']),
                'description' => trim((string) $data['description']),
                'status' => 'open',
                'resolution_notes' => null,
                'resolved_at' => null,
            ]);
        });

        return $issue->load(['reporter.position', 'reporter.department', 'department']);
    }

    /**
     * Update a workplace issue (employee edits own open report; manager/admin handles follow-up & resolution).
     *
     * @param  array<string, mixed>  $data
     */
    public function update(WorkplaceIssue $issue, array $data, UserAccount $actor): WorkplaceIssue
    {
        if ($actor->role === 'employee') {
            if ($issue->reported_by !== ($actor->employee?->id ?? 0)) {
                throw new AccessDeniedHttpException('Anda tidak memiliki akses untuk mengubah laporan milik pegawai lain.');
            }

            if (array_key_exists('status', $data) || array_key_exists('resolution_notes', $data)) {
                throw new AccessDeniedHttpException('Pegawai tidak dapat mengubah status penanganan atau catatan tindak lanjut laporan.');
            }

            if ($issue->status !== 'open') {
                throw new ConflictHttpException('Laporan yang sedang ditangani atau sudah diselesaikan tidak dapat diubah lagi oleh pelapor.');
            }

            DB::transaction(function () use ($issue, $data) {
                $fields = [];

                if (array_key_exists('category', $data)) {
                    $fields['category'] = trim((string) $data['category']);
                }

                if (array_key_exists('description', $data)) {
                    $fields['description'] = trim((string) $data['description']);
                }

                if (array_key_exists('department_id', $data)) {
                    $fields['department_id'] = (int) $data['department_id'];
                }

                if ($fields !== []) {
                    $issue->update($fields);
                }
            });

            return $issue->fresh(['reporter.position', 'reporter.department', 'department']);
        }

        DB::transaction(function () use ($issue, $data) {
            $fields = [];

            if (array_key_exists('category', $data)) {
                $fields['category'] = trim((string) $data['category']);
            }

            if (array_key_exists('description', $data)) {
                $fields['description'] = trim((string) $data['description']);
            }

            if (array_key_exists('department_id', $data)) {
                $fields['department_id'] = (int) $data['department_id'];
            }

            if (array_key_exists('resolution_notes', $data)) {
                $notes = $data['resolution_notes'] !== null ? trim((string) $data['resolution_notes']) : null;
                $fields['resolution_notes'] = $notes === '' ? null : $notes;
            }

            if (array_key_exists('status', $data)) {
                $fields['status'] = $data['status'];
                if ($data['status'] === 'resolved') {
                    $fields['resolved_at'] = $issue->resolved_at ?? now();
                } else {
                    $fields['resolved_at'] = null;
                }
            }

            if ($fields !== []) {
                $issue->update($fields);
            }
        });

        return $issue->fresh(['reporter.position', 'reporter.department', 'department']);
    }

    /**
     * Delete an open workplace issue while protecting in-progress or resolved audit trails.
     */
    public function delete(WorkplaceIssue $issue, UserAccount $actor): void
    {
        if ($actor->role === 'employee' && $issue->reported_by !== ($actor->employee?->id ?? 0)) {
            throw new AccessDeniedHttpException('Anda tidak memiliki akses untuk menghapus laporan milik pegawai lain.');
        }

        if ($issue->status !== 'open') {
            throw new ConflictHttpException('Laporan yang sedang ditangani atau sudah diselesaikan tidak dapat dihapus untuk menjaga jejak audit.');
        }

        DB::transaction(function () use ($issue) {
            $issue->delete();
        });
    }
}
