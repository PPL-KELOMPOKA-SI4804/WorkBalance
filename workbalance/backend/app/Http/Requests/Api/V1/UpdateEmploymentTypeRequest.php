<?php

namespace App\Http\Requests\Api\V1;

use App\Models\EmploymentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmploymentTypeRequest extends FormRequest
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
        /** @var EmploymentType|null $employmentType */
        $employmentType = $this->route('employmentType');
        $typeId = $employmentType?->id;

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('employment_types', 'name')->ignore($typeId),
            ],
            'work_days_per_week' => ['sometimes', 'required', 'integer', 'in:5,6'],
            'normal_weekly_hours' => ['sometimes', 'required', 'integer', 'min:1', 'max:80'],
        ];
    }
}
