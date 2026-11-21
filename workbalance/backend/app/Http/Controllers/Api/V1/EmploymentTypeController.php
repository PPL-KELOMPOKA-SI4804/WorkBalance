<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreEmploymentTypeRequest;
use App\Http\Requests\Api\V1\UpdateEmploymentTypeRequest;
use App\Models\EmploymentType;
use App\Services\EmploymentTypeService;
use Illuminate\Http\JsonResponse;

class EmploymentTypeController extends Controller
{
    public function __construct(private readonly EmploymentTypeService $employmentTypeService) {}

    public function index(): JsonResponse
    {
        $types = $this->employmentTypeService->list();

        return $this->successResponse($types, 'Daftar jenis kepegawaian berhasil diambil.');
    }

    public function store(StoreEmploymentTypeRequest $request): JsonResponse
    {
        $type = $this->employmentTypeService->create($request->validated());

        return $this->successResponse($type, 'Jenis kepegawaian berhasil ditambahkan.', 201);
    }

    public function show(EmploymentType $employmentType): JsonResponse
    {
        return $this->successResponse(
            $employmentType->loadCount('employees'),
            'Detail jenis kepegawaian berhasil diambil.'
        );
    }

    public function update(UpdateEmploymentTypeRequest $request, EmploymentType $employmentType): JsonResponse
    {
        $updated = $this->employmentTypeService->update($employmentType, $request->validated());

        return $this->successResponse($updated, 'Jenis kepegawaian berhasil diperbarui.');
    }

    public function destroy(EmploymentType $employmentType): JsonResponse
    {
        $this->employmentTypeService->delete($employmentType);

        return $this->successResponse(null, 'Jenis kepegawaian berhasil dihapus.');
    }
}
