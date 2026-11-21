<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTrainingRequest extends FormRequest
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
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'provider' => ['sometimes', 'required', 'string', 'max:150'],
            'duration_hours' => ['sometimes', 'required', 'numeric', 'min:0.5', 'max:1000'],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date'],
        ];
    }
}
