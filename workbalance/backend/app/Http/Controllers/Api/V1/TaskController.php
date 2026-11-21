<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreTaskRequest;
use App\Http\Requests\Api\V1\UpdateTaskRequest;
use App\Models\Task;
use App\Services\TaskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function __construct(private readonly TaskService $taskService) {}

    public function index(Request $request): JsonResponse
    {
        $data = $this->taskService->list($request->only([
            'search',
            'department_id',
            'priority',
            'status',
            'due_filter',
        ]));

        return $this->successResponse($data, 'Daftar tugas berhasil diambil.');
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = $this->taskService->create($request->validated(), $request->user());

        return $this->successResponse($task, 'Tugas baru berhasil ditambahkan.', 201);
    }

    public function show(Task $task): JsonResponse
    {
        $detail = $this->taskService->find($task);

        return $this->successResponse($detail, 'Detail tugas berhasil diambil.');
    }

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $updated = $this->taskService->update($task, $request->validated());

        return $this->successResponse($updated, 'Data tugas berhasil diperbarui.');
    }

    public function destroy(Task $task): JsonResponse
    {
        $this->taskService->delete($task);

        return $this->successResponse(null, 'Tugas berhasil dihapus.');
    }
}
