<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\JsonResponse;

class MasterLookupController extends Controller
{
    public function departments(): JsonResponse
    {
        $departments = Department::query()
            ->withCount('employees')
            ->orderBy('name')
            ->get();

        return $this->successResponse($departments, 'Daftar departemen berhasil diambil.');
    }

    public function positions(): JsonResponse
    {
        $positions = Position::query()
            ->withCount('employees')
            ->orderBy('title')
            ->get();

        return $this->successResponse($positions, 'Daftar jabatan berhasil diambil.');
    }
}
