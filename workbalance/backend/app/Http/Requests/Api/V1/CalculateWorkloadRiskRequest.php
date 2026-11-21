<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CalculateWorkloadRiskRequest extends FormRequest
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
            'period_week' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/'],
            'period_month' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'period_week.regex' => 'Format minggu periode harus YYYY-Www (contoh: 2026-W47).',
            'period_month.regex' => 'Format bulan periode harus YYYY-MM (contoh: 2026-11).',
            'department_id.integer' => 'Departemen yang dipilih tidak valid.',
            'department_id.exists' => 'Departemen tidak ditemukan.',
            'employee_id.integer' => 'Pegawai yang dipilih tidak valid.',
            'employee_id.exists' => 'Data pegawai tidak ditemukan.',
        ];
    }
}
