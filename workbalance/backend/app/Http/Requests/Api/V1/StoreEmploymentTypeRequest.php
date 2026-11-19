<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmploymentTypeRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100', 'unique:employment_types,name'],
            'work_days_per_week' => ['required', 'integer', 'in:5,6'],
            'normal_weekly_hours' => ['required', 'integer', 'min:1', 'max:80'],
        ];
    }
}
