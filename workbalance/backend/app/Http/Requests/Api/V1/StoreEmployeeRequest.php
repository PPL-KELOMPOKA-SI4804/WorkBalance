<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmployeeRequest extends FormRequest
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
            'employee_code' => ['required', 'string', 'max:50', 'unique:employees,employee_code'],
            'full_name' => ['required', 'string', 'max:150'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'position_id' => ['required', 'integer', 'exists:positions,id'],
            'employment_type_id' => ['required', 'integer', 'exists:employment_types,id'],
            'join_date' => ['required', 'date'],
            'status' => ['sometimes', 'in:active,inactive'],
            'email' => ['nullable', 'email', 'max:255', 'unique:user_accounts,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'in:admin,manager,employee'],
        ];
    }
}
