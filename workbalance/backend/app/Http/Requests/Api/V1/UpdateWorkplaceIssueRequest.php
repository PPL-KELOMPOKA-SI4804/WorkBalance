<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWorkplaceIssueRequest extends FormRequest
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
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'description' => ['sometimes', 'required', 'string', 'min:10', 'max:2000'],
            'department_id' => ['sometimes', 'required', 'integer', 'exists:departments,id'],
            'status' => ['sometimes', 'required', 'in:open,in_progress,resolved'],
            'resolution_notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'category.required' => 'Kategori permasalahan tidak boleh kosong.',
            'category.max' => 'Kategori permasalahan maksimal 100 karakter.',
            'description.required' => 'Deskripsi permasalahan tidak boleh kosong.',
            'description.min' => 'Deskripsi permasalahan minimal 10 karakter.',
            'description.max' => 'Deskripsi permasalahan maksimal 2000 karakter.',
            'department_id.required' => 'Departemen wajib dipilih.',
            'department_id.exists' => 'Departemen tujuan tidak ditemukan.',
            'status.in' => 'Status penanganan harus bernilai open, in_progress, atau resolved.',
            'resolution_notes.max' => 'Catatan tindak lanjut maksimal 2000 karakter.',
        ];
    }
}
