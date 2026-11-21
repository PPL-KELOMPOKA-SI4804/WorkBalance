<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ManagerDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManagerDashboardController extends Controller
{
    public function __construct(private readonly ManagerDashboardService $managerDashboardService) {}

    public function index(Request $request): JsonResponse
    {
        $summary = $this->managerDashboardService->getSummary(
            $request->only(['department_id', 'period_month', 'period_week', 'search']),
            $request->user()
        );

        return $this->successResponse(
            $summary,
            'Ringkasan indikator kondisi kerja dan beban kerja tim berhasil diambil.'
        );
    }
}
