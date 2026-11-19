<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreEmployeeRequest;
use App\Http\Requests\Api\V1\UpdateEmployeeRequest;
use App\Models\Employee;
use App\Services\EmployeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function __construct(private readonly EmployeeService $employeeService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->employeeService->list($request->only([
            'search',
            'department_id',
            'position_id',
            'employment_type_id',
            'status',
        ]));

        return $this->successResponse($data, 'Daftar pegawai berhasil diambil.');
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $employee = $this->employeeService->create($request->validated());

        return $this->successResponse($employee, 'Data pegawai berhasil ditambahkan.', 201);
    }

    public function show(Employee $employee): JsonResponse
    {
        $employee->load(['userAccount', 'department', 'position', 'employmentType']);

        return $this->successResponse($employee, 'Detail pegawai berhasil diambil.');
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee): JsonResponse
    {
        $updated = $this->employeeService->update($employee, $request->validated());

        return $this->successResponse($updated, 'Data pegawai berhasil diperbarui.');
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->employeeService->delete($employee);

        return $this->successResponse(null, 'Data pegawai berhasil dihapus.');
    }
}
