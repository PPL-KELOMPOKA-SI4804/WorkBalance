<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SurveyPrivacyGuard
{
    /**
     * Enforce NFR-02 survey response privacy for manager role.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->role === 'manager') {
            if ($request->has('employee_id') || $request->boolean('include_individual')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Akses data survei individu dilarang (NFR-02). Gunakan metrik agregat departemen.',
                    'data' => null,
                ], 403);
            }
        }

        return $next($request);
    }
}
