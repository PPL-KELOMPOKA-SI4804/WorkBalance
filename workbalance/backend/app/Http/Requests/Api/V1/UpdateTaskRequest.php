<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskRequest extends FormRequest
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
            'department_id' => ['sometimes', 'required', 'integer', 'exists:departments,id'],
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'estimated_hours' => ['sometimes', 'required', 'numeric', 'min:0.5', 'max:500'],
            'priority' => ['sometimes', 'required', 'in:low,medium,high,critical'],
            'due_date' => ['sometimes', 'required', 'date'],
            'status' => ['sometimes', 'required', 'in:open,in_progress,completed,cancelled'],
        ];
    }
}
