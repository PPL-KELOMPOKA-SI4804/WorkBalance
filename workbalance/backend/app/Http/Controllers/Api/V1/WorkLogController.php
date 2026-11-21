<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWorkLogRequest;
use App\Http\Requests\Api\V1\UpdateWorkLogRequest;
use App\Models\WorkLog;
use App\Services\WorkLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkLogController extends Controller
{
    public function __construct(private readonly WorkLogService $workLogService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->workLogService->list(
            $request->only([
                'search',
                'employee_id',
                'department_id',
                'task_assignment_id',
                'date_from',
                'date_to',
            ]),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar work log & perbandingan realisasi berhasil diambil.');
    }

    public function store(StoreWorkLogRequest $request): JsonResponse
    {
        $workLog = $this->workLogService->create($request->validated(), $request->user());

        return $this->successResponse($workLog, 'Catatan work log berhasil disimpan.', 201);
    }

    public function show(Request $request, WorkLog $workLog): JsonResponse
    {
        $detail = $this->workLogService->find($workLog, $request->user());

        return $this->successResponse($detail, 'Detail catatan work log berhasil diambil.');
    }

    public function update(UpdateWorkLogRequest $request, WorkLog $workLog): JsonResponse
    {
        $updated = $this->workLogService->update($workLog, $request->validated(), $request->user());

        return $this->successResponse($updated, 'Catatan work log berhasil diperbarui.');
    }

    public function destroy(Request $request, WorkLog $workLog): JsonResponse
    {
        $this->workLogService->delete($workLog, $request->user());

        return $this->successResponse(null, 'Catatan work log berhasil dihapus.');
    }
}
