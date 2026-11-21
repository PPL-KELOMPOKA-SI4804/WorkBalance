<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreWorkLogRequest extends FormRequest
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
            'task_assignment_id' => ['nullable', 'integer', 'exists:task_assignments,id'],
            'employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'work_date' => ['required', 'date', 'date_format:Y-m-d'],
            'hours_spent' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'activity_description' => ['required', 'string', 'min:5', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'task_assignment_id.integer' => 'Penugasan tugas tidak valid.',
            'task_assignment_id.exists' => 'Penugasan tugas tidak ditemukan.',
            'employee_id.integer' => 'Pegawai yang dipilih tidak valid.',
            'employee_id.exists' => 'Data pegawai tidak ditemukan.',
            'work_date.required' => 'Tanggal kerja wajib diisi.',
            'work_date.date' => 'Format tanggal kerja tidak valid.',
            'work_date.date_format' => 'Tanggal kerja harus berformat YYYY-MM-DD.',
            'hours_spent.required' => 'Durasi jam kerja aktual wajib diisi.',
            'hours_spent.numeric' => 'Durasi jam kerja aktual harus berupa angka.',
            'hours_spent.min' => 'Durasi jam kerja aktual minimal 0.25 jam (15 menit).',
            'hours_spent.max' => 'Durasi jam kerja aktual maksimal 24 jam per catatan.',
            'activity_description.required' => 'Deskripsi aktivitas kerja wajib diisi.',
            'activity_description.min' => 'Deskripsi aktivitas kerja minimal 5 karakter.',
            'activity_description.max' => 'Deskripsi aktivitas kerja maksimal 2000 karakter.',
        ];
    }
}
