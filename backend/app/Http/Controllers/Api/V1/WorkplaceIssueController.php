<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWorkplaceIssueRequest;
use App\Http\Requests\Api\V1\UpdateWorkplaceIssueRequest;
use App\Models\WorkplaceIssue;
use App\Services\WorkplaceIssueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkplaceIssueController extends Controller
{
    public function __construct(private readonly WorkplaceIssueService $workplaceIssueService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->workplaceIssueService->list(
            $request->only(['search', 'department_id', 'category', 'status', 'reported_by']),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar laporan permasalahan kerja berhasil diambil.');
    }

    public function store(StoreWorkplaceIssueRequest $request): JsonResponse
    {
        $issue = $this->workplaceIssueService->create($request->validated(), $request->user());

        return $this->successResponse($issue, 'Laporan permasalahan kerja berhasil dikirim.', 201);
    }

    public function show(Request $request, WorkplaceIssue $workplaceIssue): JsonResponse
    {
        $issue = $this->workplaceIssueService->find($workplaceIssue, $request->user());

        return $this->successResponse($issue, 'Detail laporan permasalahan kerja berhasil diambil.');
    }

    public function update(UpdateWorkplaceIssueRequest $request, WorkplaceIssue $workplaceIssue): JsonResponse
    {
        $updated = $this->workplaceIssueService->update($workplaceIssue, $request->validated(), $request->user());

        return $this->successResponse($updated, 'Laporan permasalahan kerja berhasil diperbarui.');
    }

    public function destroy(Request $request, WorkplaceIssue $workplaceIssue): JsonResponse
    {
        $this->workplaceIssueService->delete($workplaceIssue, $request->user());

        return $this->successResponse(null, 'Laporan permasalahan kerja berhasil dihapus.');
    }
}
