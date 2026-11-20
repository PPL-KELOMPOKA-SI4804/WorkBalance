<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreTrainingRequest;
use App\Http\Requests\Api\V1\UpdateTrainingRequest;
use App\Models\Training;
use App\Services\TrainingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrainingController extends Controller
{
    public function __construct(private readonly TrainingService $trainingService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->trainingService->list($request->only([
            'search',
            'category',
            'schedule_status',
        ]));

        return $this->successResponse($data, 'Katalog pelatihan berhasil diambil.');
    }

    public function store(StoreTrainingRequest $request): JsonResponse
    {
        $training = $this->trainingService->create($request->validated());

        return $this->successResponse($training, 'Program pelatihan berhasil ditambahkan.', 201);
    }

    public function show(Training $training): JsonResponse
    {
        $detail = $this->trainingService->find($training);

        return $this->successResponse($detail, 'Detail program pelatihan berhasil diambil.');
    }

    public function update(UpdateTrainingRequest $request, Training $training): JsonResponse
    {
        $updated = $this->trainingService->update($training, $request->validated());

        return $this->successResponse($updated, 'Program pelatihan berhasil diperbarui.');
    }

    public function destroy(Training $training): JsonResponse
    {
        $this->trainingService->delete($training);

        return $this->successResponse(null, 'Program pelatihan berhasil dihapus.');
    }
}
