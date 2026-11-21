<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
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
        /** @var Employee|null $employee */
        $employee = $this->route('employee');
        $employeeId = $employee?->id;
        $userAccountId = $employee?->user_account_id;

        return [
            'employee_code' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('employees', 'employee_code')->ignore($employeeId),
            ],
            'full_name' => ['sometimes', 'required', 'string', 'max:150'],
            'department_id' => ['sometimes', 'required', 'integer', 'exists:departments,id'],
            'position_id' => ['sometimes', 'required', 'integer', 'exists:positions,id'],
            'employment_type_id' => ['sometimes', 'required', 'integer', 'exists:employment_types,id'],
            'join_date' => ['sometimes', 'required', 'date'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('user_accounts', 'email')->ignore($userAccountId),
            ],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'required', 'in:admin,manager,employee'],
        ];
    }
}
