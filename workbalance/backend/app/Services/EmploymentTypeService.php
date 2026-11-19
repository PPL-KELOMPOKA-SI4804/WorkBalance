<?php

namespace App\Services;

use App\Models\EmploymentType;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class EmploymentTypeService
{
    /**
     * Retrieve all employment types along with linked employee counts.
     *
     * @return Collection<int, EmploymentType>
     */
    public function list(): Collection
    {
        return EmploymentType::query()
            ->withCount('employees')
            ->orderBy('id')
            ->get();
    }

    /**
     * Create a new employment type.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): EmploymentType
    {
        $type = EmploymentType::create([
            'name' => $data['name'],
            'work_days_per_week' => $data['work_days_per_week'],
            'normal_weekly_hours' => $data['normal_weekly_hours'],
        ]);

        return $type->loadCount('employees');
    }

    /**
     * Update an existing employment type.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(EmploymentType $employmentType, array $data): EmploymentType
    {
        $employmentType->update($data);

        return $employmentType->fresh()->loadCount('employees');
    }

    /**
     * Delete an employment type unless still referenced by active/stored employees.
     */
    public function delete(EmploymentType $employmentType): void
    {
        if ($employmentType->employees()->exists()) {
            throw new ConflictHttpException('Jenis kepegawaian tidak dapat dihapus karena masih digunakan oleh pegawai.');
        }

        $employmentType->delete();
    }
}
