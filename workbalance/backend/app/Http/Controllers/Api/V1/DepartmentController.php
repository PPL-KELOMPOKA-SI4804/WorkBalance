<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreDepartmentRequest;
use App\Http\Requests\Api\V1\UpdateDepartmentRequest;
use App\Models\Department;
use App\Services\DepartmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct(private readonly DepartmentService $departmentService) {}

    public function index(Request $request): JsonResponse
    {
        $departments = $this->departmentService->list($request->only([
            'search',
            'has_manager',
        ]));

        return $this->successResponse($departments, 'Daftar departemen berhasil diambil.');
    }

    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $department = $this->departmentService->create($request->validated());

        return $this->successResponse($department, 'Data departemen berhasil ditambahkan.', 201);
    }

    public function show(Department $department): JsonResponse
    {
        $detail = $this->departmentService->find($department);

        return $this->successResponse($detail, 'Detail departemen berhasil diambil.');
    }

    public function update(UpdateDepartmentRequest $request, Department $department): JsonResponse
    {
        $updated = $this->departmentService->update($department, $request->validated());

        return $this->successResponse($updated, 'Data departemen berhasil diperbarui.');
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->departmentService->delete($department);

        return $this->successResponse(null, 'Data departemen berhasil dihapus.');
    }
}
