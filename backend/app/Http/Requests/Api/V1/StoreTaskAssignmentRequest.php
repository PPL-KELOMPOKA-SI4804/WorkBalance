<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreTaskAssignmentRequest extends FormRequest
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
            'task_id' => ['required', 'integer', 'exists:tasks,id'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'assigned_by' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'assigned_at' => ['sometimes', 'nullable', 'date'],
            'deadline' => ['required', 'date'],
            'status' => ['sometimes', 'in:assigned,in_progress,completed'],
        ];
    }
}
