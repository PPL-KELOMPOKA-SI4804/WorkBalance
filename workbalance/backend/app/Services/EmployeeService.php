<?php

namespace App\Services;

use App\Models\ActionUpdate;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\ImprovementAction;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class EmployeeService
{
    /**
     * Retrieve filtered employee records alongside master summary metrics.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters = []): array
    {
        $query = Employee::query()
            ->with(['userAccount', 'department', 'position', 'employmentType']);

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('employee_code', 'like', "%{$search}%")
                    ->orWhereHas('userAccount', fn ($uq) => $uq->where('email', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (! empty($filters['position_id'])) {
            $query->where('position_id', (int) $filters['position_id']);
        }

        if (! empty($filters['employment_type_id'])) {
            $query->where('employment_type_id', (int) $filters['employment_type_id']);
        }

        if (! empty($filters['status']) && in_array($filters['status'], ['active', 'inactive'], true)) {
            $query->where('status', $filters['status']);
        }

        $employees = $query->orderBy('employee_code')->get();

        $total = Employee::count();
        $active = Employee::where('status', 'active')->count();

        return [
            'employees' => $employees,
            'summary' => [
                'total' => $total,
                'active' => $active,
                'inactive' => $total - $active,
                'employment_types_count' => EmploymentType::count(),
            ],
        ];
    }

    /**
     * Create a new employee and optional linked user account inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Employee
    {
        return DB::transaction(function () use ($data) {
            $status = $data['status'] ?? 'active';
            $userAccountId = null;

            if (! empty($data['email'])) {
                $userAccount = UserAccount::create([
                    'email' => $data['email'],
                    'password_hash' => Hash::make($data['password'] ?? 'password123'),
                    'role' => $data['role'] ?? 'employee',
                    'is_active' => $status === 'active',
                ]);
                $userAccountId = $userAccount->id;
            }

            $employee = Employee::create([
                'user_account_id' => $userAccountId,
                'department_id' => $data['department_id'],
                'position_id' => $data['position_id'],
                'employment_type_id' => $data['employment_type_id'],
                'employee_code' => $data['employee_code'],
                'full_name' => $data['full_name'],
                'join_date' => $data['join_date'],
                'status' => $status,
            ]);

            return $employee->load(['userAccount', 'department', 'position', 'employmentType']);
        });
    }

    /**
     * Update an employee and synchronize its linked user account inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Employee $employee, array $data): Employee
    {
        return DB::transaction(function () use ($employee, $data) {
            $employeeFields = array_intersect_key($data, array_flip([
                'department_id',
                'position_id',
                'employment_type_id',
                'employee_code',
                'full_name',
                'join_date',
                'status',
            ]));

            if ($employeeFields !== []) {
                $employee->update($employeeFields);
            }

            $isActive = $employee->status === 'active';
            $userAccount = $employee->userAccount;

            if ($userAccount) {
                $accountUpdates = ['is_active' => $isActive];

                if (array_key_exists('email', $data) && ! empty($data['email'])) {
                    $accountUpdates['email'] = $data['email'];
                }

                if (array_key_exists('role', $data) && ! empty($data['role'])) {
                    $accountUpdates['role'] = $data['role'];
                }

                if (! empty($data['password'])) {
                    $accountUpdates['password_hash'] = Hash::make($data['password']);
                }

                $userAccount->update($accountUpdates);
            } elseif (! empty($data['email'])) {
                $newAccount = UserAccount::create([
                    'email' => $data['email'],
                    'password_hash' => Hash::make($data['password'] ?? 'password123'),
                    'role' => $data['role'] ?? 'employee',
                    'is_active' => $isActive,
                ]);
                $employee->update(['user_account_id' => $newAccount->id]);
            }

            return $employee->fresh(['userAccount', 'department', 'position', 'employmentType']);
        });
    }

    /**
     * Delete an employee safely while guarding active operational references.
     */
    public function delete(Employee $employee): void
    {
        if ($employee->managedDepartments()->exists()) {
            throw new ConflictHttpException('Pegawai tidak dapat dihapus karena masih ditunjuk sebagai manajer departemen.');
        }

        $hasOperationalRefs = Task::where('created_by', $employee->id)->exists()
            || TaskAssignment::where('assigned_by', $employee->id)->exists()
            || ImprovementAction::where('pic_employee_id', $employee->id)->exists()
            || ActionUpdate::where('updated_by', $employee->id)->exists();

        if ($hasOperationalRefs) {
            throw new ConflictHttpException('Pegawai tidak dapat dihapus karena masih memiliki riwayat referensi operasional.');
        }

        DB::transaction(function () use ($employee) {
            $userAccount = $employee->userAccount;
            $employee->delete();

            if ($userAccount) {
                $userAccount->tokens()->delete();
                $userAccount->delete();
            }
        });
    }
}
