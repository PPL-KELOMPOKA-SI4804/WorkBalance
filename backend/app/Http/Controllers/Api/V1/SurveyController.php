<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWorkSurveyRequest;
use App\Http\Requests\Api\V1\SubmitSurveyResponseRequest;
use App\Http\Requests\Api\V1\UpdateWorkSurveyRequest;
use App\Models\WorkSurvey;
use App\Services\SurveyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SurveyController extends Controller
{
    public function __construct(private readonly SurveyService $surveyService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->surveyService->list(
            $request->only(['search', 'period_month', 'is_active']),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar survei kondisi kerja berhasil diambil.');
    }

    public function show(Request $request, WorkSurvey $survey): JsonResponse
    {
        $data = $this->surveyService->find($survey, $request->user());

        return $this->successResponse($data, 'Detail survei kondisi kerja berhasil diambil.');
    }

    public function store(StoreWorkSurveyRequest $request): JsonResponse
    {
        $survey = $this->surveyService->createSurvey($request->validated(), $request->user());

        return $this->successResponse($survey, 'Periode survei kondisi kerja berhasil dibuat.', 201);
    }

    public function update(UpdateWorkSurveyRequest $request, WorkSurvey $survey): JsonResponse
    {
        $updated = $this->surveyService->updateSurvey($survey, $request->validated(), $request->user());

        return $this->successResponse($updated, 'Survei kondisi kerja berhasil diperbarui.');
    }

    public function destroy(WorkSurvey $survey): JsonResponse
    {
        $this->surveyService->deleteSurvey($survey);

        return $this->successResponse(null, 'Survei kondisi kerja berhasil dihapus.');
    }

    public function submitResponse(SubmitSurveyResponseRequest $request, WorkSurvey $survey): JsonResponse
    {
        $response = $this->surveyService->submitResponse($survey, $request->validated(), $request->user());

        return $this->successResponse($response, 'Respons survei Anda berhasil dikirim.', 201);
    }

    public function updateResponse(SubmitSurveyResponseRequest $request, WorkSurvey $survey): JsonResponse
    {
        $response = $this->surveyService->updateResponse($survey, $request->validated(), $request->user());

        return $this->successResponse($response, 'Respons survei Anda berhasil diperbarui.');
    }
}
