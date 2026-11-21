<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CalculateWorkloadRiskRequest;
use App\Models\WorkloadRisk;
use App\Services\WorkloadRiskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkloadRiskController extends Controller
{
    public function __construct(private readonly WorkloadRiskService $workloadRiskService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->workloadRiskService->list(
            $request->only([
                'period_week',
                'period_month',
                'department_id',
                'employee_id',
                'risk_category',
                'is_overridden',
                'search',
            ]),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar analisis Workload Risk berhasil diambil.');
    }

    public function calculate(CalculateWorkloadRiskRequest $request): JsonResponse
    {
        $data = $this->workloadRiskService->calculate($request->validated(), $request->user());

        return $this->successResponse($data, 'Kalkulasi ulang Workload Risk berhasil disimpan.');
    }

    public function show(Request $request, WorkloadRisk $workloadRisk): JsonResponse
    {
        $detail = $this->workloadRiskService->find($workloadRisk, $request->user());

        return $this->successResponse($detail, 'Detail analisis Workload Risk berhasil diambil.');
    }
}
