<?php

namespace App\Services;

use App\Models\Department;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class DepartmentService
{
    /**
     * Retrieve departments with manager details and related entity counts.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, Department>
     */
    public function list(array $filters = []): Collection
    {
        $query = Department::query()
            ->with(['manager.position'])
            ->withCount($this->departmentCounts());

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('manager', function ($mq) use ($search) {
                        $mq->where('full_name', 'like', "%{$search}%")
                            ->orWhere('employee_code', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($filters['has_manager'])) {
            if ($filters['has_manager'] === 'with_manager') {
                $query->whereNotNull('manager_id');
            } elseif ($filters['has_manager'] === 'without_manager') {
                $query->whereNull('manager_id');
            }
        }

        return $query->orderBy('name')->get();
    }

    /**
     * Load complete details of a single department including assigned employees.
     */
    public function find(Department $department): Department
    {
        return $department
            ->load(['manager.position', 'employees.position', 'employees.employmentType'])
            ->loadCount($this->departmentCounts());
    }

    /**
     * Create a new department inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Department
    {
        return DB::transaction(function () use ($data) {
            $description = isset($data['description']) ? trim((string) $data['description']) : null;

            $department = Department::create([
                'code' => trim((string) $data['code']),
                'name' => trim((string) $data['name']),
                'description' => $description === '' ? null : $description,
                'manager_id' => ! empty($data['manager_id']) ? (int) $data['manager_id'] : null,
            ]);

            return $department
                ->load(['manager.position'])
                ->loadCount($this->departmentCounts());
        });
    }

    /**
     * Update an existing department inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Department $department, array $data): Department
    {
        return DB::transaction(function () use ($department, $data) {
            $fields = [];

            if (array_key_exists('code', $data)) {
                $fields['code'] = trim((string) $data['code']);
            }

            if (array_key_exists('name', $data)) {
                $fields['name'] = trim((string) $data['name']);
            }

            if (array_key_exists('description', $data)) {
                $description = $data['description'] !== null ? trim((string) $data['description']) : null;
                $fields['description'] = $description === '' ? null : $description;
            }

            if (array_key_exists('manager_id', $data)) {
                $fields['manager_id'] = ! empty($data['manager_id']) ? (int) $data['manager_id'] : null;
            }

            if ($fields !== []) {
                $department->update($fields);
            }

            return $department
                ->fresh(['manager.position'])
                ->loadCount($this->departmentCounts());
        });
    }

    /**
     * Delete a department only when it has no linked employees or operational history.
     */
    public function delete(Department $department): void
    {
        if ($department->employees()->exists()) {
            throw new ConflictHttpException('Departemen tidak dapat dihapus karena masih memiliki pegawai yang terdaftar.');
        }

        $hasOperationalRefs = $department->tasks()->exists()
            || $department->workplaceIssues()->exists()
            || $department->safetyIncidents()->exists()
            || $department->improvementActions()->exists();

        if ($hasOperationalRefs) {
            throw new ConflictHttpException('Departemen tidak dapat dihapus karena masih memiliki riwayat referensi operasional.');
        }

        $department->delete();
    }

    /**
     * Shared eager-count specification for department queries.
     *
     * @return array<int|string, mixed>
     */
    private function departmentCounts(): array
    {
        return [
            'employees',
            'employees as active_employees_count' => fn ($q) => $q->where('status', 'active'),
            'tasks',
        ];
    }
}
