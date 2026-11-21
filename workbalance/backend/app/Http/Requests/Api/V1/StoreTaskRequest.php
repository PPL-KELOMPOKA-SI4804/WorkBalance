<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreTaskRequest extends FormRequest
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
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'created_by' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'estimated_hours' => ['required', 'numeric', 'min:0.5', 'max:500'],
            'priority' => ['required', 'in:low,medium,high,critical'],
            'due_date' => ['required', 'date'],
            'status' => ['sometimes', 'in:open,in_progress,completed,cancelled'],
        ];
    }
}
