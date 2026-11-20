<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreTaskAssignmentRequest;
use App\Http\Requests\Api\V1\UpdateTaskAssignmentRequest;
use App\Models\TaskAssignment;
use App\Services\TaskAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskAssignmentController extends Controller
{
    public function __construct(private readonly TaskAssignmentService $taskAssignmentService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->taskAssignmentService->list(
            $request->only([
                'search',
                'task_id',
                'employee_id',
                'department_id',
                'status',
                'deadline_filter',
            ]),
            $request->user()
        );

        return $this->successResponse($data, 'Daftar penugasan berhasil diambil.');
    }

    public function store(StoreTaskAssignmentRequest $request): JsonResponse
    {
        $assignment = $this->taskAssignmentService->create($request->validated(), $request->user());

        return $this->successResponse($assignment, 'Penugasan pegawai berhasil ditambahkan.', 201);
    }

    public function show(Request $request, TaskAssignment $taskAssignment): JsonResponse
    {
        $detail = $this->taskAssignmentService->find($taskAssignment, $request->user());

        return $this->successResponse($detail, 'Detail penugasan berhasil diambil.');
    }

    public function update(UpdateTaskAssignmentRequest $request, TaskAssignment $taskAssignment): JsonResponse
    {
        $updated = $this->taskAssignmentService->update($taskAssignment, $request->validated());

        return $this->successResponse($updated, 'Data penugasan berhasil diperbarui.');
    }

    public function destroy(TaskAssignment $taskAssignment): JsonResponse
    {
        $this->taskAssignmentService->delete($taskAssignment);

        return $this->successResponse(null, 'Data penugasan berhasil dihapus.');
    }
}
