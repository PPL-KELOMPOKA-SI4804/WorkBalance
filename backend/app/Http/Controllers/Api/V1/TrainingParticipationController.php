<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreTrainingParticipationRequest;
use App\Http\Requests\Api\V1\UpdateTrainingParticipationRequest;
use App\Models\TrainingParticipation;
use App\Services\TrainingParticipationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrainingParticipationController extends Controller
{
    public function __construct(private readonly TrainingParticipationService $participationService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->participationService->list(
            $request->only([
                'search',
                'training_id',
                'employee_id',
                'department_id',
                'status',
            ]),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar keikutsertaan pelatihan berhasil diambil.');
    }

    public function store(StoreTrainingParticipationRequest $request): JsonResponse
    {
        $participation = $this->participationService->create($request->validated());

        return $this->successResponse($participation, 'Pegawai berhasil didaftarkan ke program pelatihan.', 201);
    }

    public function show(Request $request, TrainingParticipation $trainingParticipation): JsonResponse
    {
        $detail = $this->participationService->find($trainingParticipation, $request->user());

        return $this->successResponse($detail, 'Detail keikutsertaan pelatihan berhasil diambil.');
    }

    public function update(
        UpdateTrainingParticipationRequest $request,
        TrainingParticipation $trainingParticipation
    ): JsonResponse {
        $updated = $this->participationService->update($trainingParticipation, $request->validated());

        return $this->successResponse($updated, 'Status keikutsertaan pelatihan berhasil diperbarui.');
    }

    public function destroy(TrainingParticipation $trainingParticipation): JsonResponse
    {
        $this->participationService->delete($trainingParticipation);

        return $this->successResponse(null, 'Data keikutsertaan pelatihan berhasil dihapus.');
    }
}
