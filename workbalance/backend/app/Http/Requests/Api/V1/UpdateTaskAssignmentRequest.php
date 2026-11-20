<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'task_id' => ['sometimes', 'required', 'integer', 'exists:tasks,id'],
            'employee_id' => ['sometimes', 'required', 'integer', 'exists:employees,id'],
            'assigned_at' => ['sometimes', 'nullable', 'date'],
            'deadline' => ['sometimes', 'required', 'date'],
            'status' => ['sometimes', 'required', 'in:assigned,in_progress,completed'],
        ];
    }
}
