<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreWorkplaceIssueRequest extends FormRequest
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
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'category.required' => 'Kategori permasalahan wajib diisi.',
            'category.max' => 'Kategori permasalahan maksimal 100 karakter.',
            'description.required' => 'Deskripsi permasalahan wajib diisi.',
            'description.min' => 'Deskripsi permasalahan minimal 10 karakter agar mudah ditindaklanjuti.',
            'description.max' => 'Deskripsi permasalahan maksimal 2000 karakter.',
            'department_id.integer' => 'Departemen tujuan tidak valid.',
            'department_id.exists' => 'Departemen tujuan tidak ditemukan.',
        ];
    }
}
