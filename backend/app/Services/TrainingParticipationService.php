<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\TrainingParticipation;
use App\Models\UserAccount;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TrainingParticipationService
{
    /**
     * Retrieve filtered training participations and coverage metrics scoped by actor role.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        $query = TrainingParticipation::query()
            ->with(['training', 'employee.department', 'employee.position']);

        if ($actor->role === 'employee') {
            $query->where('employee_id', $actor->employee?->id ?? 0);
        } elseif (! empty($filters['employee_id'])) {
            $query->where('employee_id', (int) $filters['employee_id']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('training', function ($tq) use ($search) {
                    $tq->where('title', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('provider', 'like', "%{$search}%");
                })->orWhereHas('employee', function ($eq) use ($search) {
                    $eq->where('full_name', 'like', "%{$search}%")
                        ->orWhere('employee_code', 'like', "%{$search}%");
                });
            });
        }

        if (! empty($filters['training_id'])) {
            $query->where('training_id', (int) $filters['training_id']);
        }

        if (! empty($filters['department_id'])) {
            $departmentId = (int) $filters['department_id'];
            $query->whereHas('employee', fn ($eq) => $eq->where('department_id', $departmentId));
        }

        if (! empty($filters['status']) && in_array($filters['status'], ['enrolled', 'completed', 'dropped'], true)) {
            $query->where('status', $filters['status']);
        }

        $participations = $query
            ->orderByRaw("CASE status WHEN 'enrolled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->get();

        $summaryBase = TrainingParticipation::query();
        if ($actor->role === 'employee') {
            $summaryBase->where('employee_id', $actor->employee?->id ?? 0);
        }

        $total = (clone $summaryBase)->count();
        $enrolled = (clone $summaryBase)->where('status', 'enrolled')->count();
        $completed = (clone $summaryBase)->where('status', 'completed')->count();
        $dropped = (clone $summaryBase)->where('status', 'dropped')->count();

        $trainedEmployeesCount = (clone $summaryBase)
            ->whereIn('status', ['enrolled', 'completed'])
            ->distinct('employee_id')
            ->count('employee_id');

        if ($actor->role === 'employee') {
            $trainingCoverageRate = $trainedEmployeesCount > 0 ? 100.0 : 0.0;
        } else {
            $activeEmployeesCount = Employee::where('status', 'active')->count();
            $trainedActiveEmployeesCount = TrainingParticipation::query()
                ->whereIn('status', ['enrolled', 'completed'])
                ->whereHas('employee', fn ($eq) => $eq->where('status', 'active'))
                ->distinct('employee_id')
                ->count('employee_id');

            $trainingCoverageRate = $activeEmployeesCount > 0
                ? round(($trainedActiveEmployeesCount / $activeEmployeesCount) * 100, 1)
                : 0.0;
        }

        return [
            'participations' => $participations,
            'summary' => [
                'total' => $total,
                'enrolled' => $enrolled,
                'completed' => $completed,
                'dropped' => $dropped,
                'trained_employees_count' => $trainedEmployeesCount,
                'training_coverage_rate' => $trainingCoverageRate,
            ],
        ];
    }

    /**
     * Load complete details of a participation record with ownership guard for employees.
     */
    public function find(TrainingParticipation $participation, UserAccount $actor): TrainingParticipation
    {
        if ($actor->role === 'employee' && $participation->employee_id !== $actor->employee?->id) {
            throw new AccessDeniedHttpException('Anda tidak memiliki izin untuk melihat data keikutsertaan pelatihan pegawai lain.');
        }

        return $participation->load([
            'training',
            'employee.department',
            'employee.position',
            'employee.employmentType',
        ]);
    }

    /**
     * Enroll an active employee into a training program inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): TrainingParticipation
    {
        return DB::transaction(function () use ($data) {
            $trainingId = (int) $data['training_id'];
            $employee = Employee::findOrFail((int) $data['employee_id']);

            $this->guardTarget($trainingId, $employee);

            $status = $data['status'] ?? 'enrolled';
            $completionDate = $status === 'completed'
                ? (! empty($data['completion_date']) ? $data['completion_date'] : now()->toDateString())
                : null;

            $participation = TrainingParticipation::create([
                'training_id' => $trainingId,
                'employee_id' => $employee->id,
                'status' => $status,
                'completion_date' => $completionDate,
            ]);

            return $participation->load(['training', 'employee.department', 'employee.position']);
        });
    }

    /**
     * Update a training participation status or enrollment inside a transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(TrainingParticipation $participation, array $data): TrainingParticipation
    {
        return DB::transaction(function () use ($participation, $data) {
            $newTrainingId = array_key_exists('training_id', $data)
                ? (int) $data['training_id']
                : $participation->training_id;
            $newEmployeeId = array_key_exists('employee_id', $data)
                ? (int) $data['employee_id']
                : $participation->employee_id;

            if ($newTrainingId !== $participation->training_id || $newEmployeeId !== $participation->employee_id) {
                $employee = Employee::findOrFail($newEmployeeId);
                $this->guardTarget($newTrainingId, $employee, $participation->id);
            }

            $newStatus = array_key_exists('status', $data) ? $data['status'] : $participation->status;

            if ($newStatus === 'completed') {
                $completionDate = (array_key_exists('completion_date', $data) && ! empty($data['completion_date']))
                    ? $data['completion_date']
                    : ($participation->completion_date?->toDateString() ?? now()->toDateString());
            } else {
                $completionDate = null;
            }

            $participation->update([
                'training_id' => $newTrainingId,
                'employee_id' => $newEmployeeId,
                'status' => $newStatus,
                'completion_date' => $completionDate,
            ]);

            return $participation->fresh(['training', 'employee.department', 'employee.position']);
        });
    }

    /**
     * Delete a training participation unless it is already completed.
     */
    public function delete(TrainingParticipation $participation): void
    {
        if ($participation->status === 'completed') {
            throw new ConflictHttpException('Data keikutsertaan pelatihan yang sudah lulus (completed) tidak dapat dihapus untuk menjaga riwayat kompetensi.');
        }

        DB::transaction(function () use ($participation) {
            $participation->delete();
        });
    }

    /**
     * Validate active employee status and uniqueness of (training_id, employee_id).
     */
    private function guardTarget(int $trainingId, Employee $employee, ?int $ignoreId = null): void
    {
        if ($employee->status !== 'active') {
            throw new ConflictHttpException('Tidak dapat mendaftarkan pegawai berstatus nonaktif ke program pelatihan.');
        }

        $duplicateQuery = TrainingParticipation::query()
            ->where('training_id', $trainingId)
            ->where('employee_id', $employee->id);

        if ($ignoreId !== null) {
            $duplicateQuery->where('id', '!=', $ignoreId);
        }

        if ($duplicateQuery->exists()) {
            throw new ConflictHttpException('Pegawai tersebut sudah terdaftar pada program pelatihan ini.');
        }
    }
}
