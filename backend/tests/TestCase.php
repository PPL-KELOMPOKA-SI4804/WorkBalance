<?php

namespace Tests;

use App\Models\UserAccount;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Issue a signed HS256 JWT access token for authenticated feature tests.
     */
    protected function issueJwt(UserAccount $user): string
    {
        return app(JwtService::class)->issueAccessToken($user)['token'];
    }
}
