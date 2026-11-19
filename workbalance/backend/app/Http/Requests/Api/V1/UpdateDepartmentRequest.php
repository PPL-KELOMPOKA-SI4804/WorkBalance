<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Department;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDepartmentRequest extends FormRequest
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
        /** @var Department|null $department */
        $department = $this->route('department');
        $departmentId = $department?->id;

        return [
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:30',
                Rule::unique('departments', 'code')->ignore($departmentId),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'manager_id' => ['nullable', 'integer', 'exists:employees,id'],
        ];
    }
}
