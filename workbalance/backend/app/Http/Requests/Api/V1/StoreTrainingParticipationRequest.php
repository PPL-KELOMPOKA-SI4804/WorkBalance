<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreTrainingParticipationRequest extends FormRequest
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
            'training_id' => ['required', 'integer', 'exists:trainings,id'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'status' => ['sometimes', 'in:enrolled,completed,dropped'],
            'completion_date' => ['nullable', 'date'],
        ];
    }
}
