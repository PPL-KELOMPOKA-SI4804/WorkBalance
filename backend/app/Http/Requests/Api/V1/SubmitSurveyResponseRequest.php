<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class SubmitSurveyResponseRequest extends FormRequest
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
            'work_life_balance_score' => ['required', 'integer', 'min:1', 'max:5'],
            'workload_perception_score' => ['required', 'integer', 'min:1', 'max:5'],
            'comments' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
