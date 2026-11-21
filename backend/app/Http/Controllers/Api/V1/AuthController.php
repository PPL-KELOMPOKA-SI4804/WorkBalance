<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:user_accounts,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['sometimes', 'in:admin,manager,employee'],
        ]);

        $actingUser = auth('sanctum')->user();
        $role = ($actingUser && $actingUser->role === 'admin' && isset($validated['role']))
            ? $validated['role']
            : 'employee';

        $user = UserAccount::create([
            'email' => $validated['email'],
            'password_hash' => Hash::make($validated['password']),
            'role' => $role,
            'is_active' => true,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load(['employee.department', 'employee.position', 'employee.employmentType']),
        ], 'Registrasi akun berhasil.', 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = UserAccount::with(['employee.department', 'employee.position', 'employee.employmentType'])
            ->where('email', $credentials['email'])
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password_hash)) {
            return $this->errorResponse('Email atau kata sandi tidak valid.', 401);
        }

        if (! $user->is_active) {
            return $this->errorResponse('Akun pengguna sedang dinonaktifkan.', 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ], 'Login berhasil.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['employee.department', 'employee.position', 'employee.employmentType']);

        return $this->successResponse([
            'user' => $user,
        ], 'Profil sesi aktif berhasil diambil.');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->successResponse(null, 'Logout berhasil.');
    }
}
