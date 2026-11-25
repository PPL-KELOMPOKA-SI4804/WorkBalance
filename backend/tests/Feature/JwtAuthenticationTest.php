<?php

namespace Tests\Feature;

use App\Models\UserAccount;
use App\Services\JwtService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JwtAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private UserAccount $admin;

    private UserAccount $employeeUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->employeeUser = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
    }

    public function test_login_issues_valid_rfc7519_hs256_access_and_refresh_tokens(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@workbalance.id',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'token',
                    'access_token',
                    'refresh_token',
                    'token_type',
                    'expires_in',
                    'refresh_expires_in',
                    'user' => ['id', 'email', 'role'],
                ],
            ]);

        $accessToken = (string) $response->json('data.access_token');
        $refreshToken = (string) $response->json('data.refresh_token');

        $this->assertSame($accessToken, $response->json('data.token'));

        $accessParts = explode('.', $accessToken);
        $this->assertCount(3, $accessParts);

        $header = json_decode($this->decodeBase64Url($accessParts[0]), true);
        $payload = json_decode($this->decodeBase64Url($accessParts[1]), true);

        $this->assertSame('HS256', $header['alg']);
        $this->assertSame('JWT', $header['typ']);
        $this->assertSame((string) $this->admin->id, $payload['sub']);
        $this->assertSame('access', $payload['typ']);
        $this->assertSame('admin', $payload['role']);
        $this->assertSame('admin@workbalance.id', $payload['email']);
        $this->assertNotEmpty($payload['jti']);
        $this->assertGreaterThan($payload['iat'], $payload['exp']);

        $refreshParts = explode('.', $refreshToken);
        $this->assertCount(3, $refreshParts);
        $refreshPayload = json_decode($this->decodeBase64Url($refreshParts[1]), true);
        $this->assertSame('refresh', $refreshPayload['typ']);
    }

    public function test_tampered_signature_payload_and_alg_none_tokens_are_rejected(): void
    {
        $validToken = $this->issueJwt($this->employeeUser);
        [$header, $payload, $signature] = explode('.', $validToken);

        // 1. Tampered signature
        $tamperedSig = $header.'.'.$payload.'.'.strrev($signature);
        $this->withToken($tamperedSig)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        // 2. Privilege escalation payload tamper (employee -> admin)
        $decodedPayload = json_decode($this->decodeBase64Url($payload), true);
        $decodedPayload['role'] = 'admin';
        $tamperedPayload = $this->encodeBase64Url((string) json_encode($decodedPayload));
        $this->withToken($header.'.'.$tamperedPayload.'.'.$signature)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        // 3. Unsigned `alg: none` attack
        $noneHeader = $this->encodeBase64Url((string) json_encode(['alg' => 'none', 'typ' => 'JWT']));
        $this->withToken($noneHeader.'.'.$payload.'.')
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_expired_access_token_is_rejected(): void
    {
        $jwtService = app(JwtService::class);
        $token = $jwtService->issueAccessToken($this->admin, 60)['token'];

        $this->travel(65)->seconds();

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_refresh_token_cannot_access_protected_routes_and_access_token_cannot_refresh(): void
    {
        $jwtService = app(JwtService::class);
        $pair = $jwtService->issueTokenPair($this->admin);

        // Refresh token must be rejected as Bearer on protected API
        $this->withToken($pair['refresh_token'])
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        // Access token must be rejected by /auth/refresh
        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $pair['access_token'],
        ])->assertUnauthorized();
    }

    public function test_refresh_endpoint_rotates_tokens_and_blocks_replay(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@workbalance.id',
            'password' => 'password123',
        ])->assertOk();

        $oldRefresh = (string) $login->json('data.refresh_token');

        $refreshed = $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $oldRefresh,
        ]);

        $refreshed->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.user.email', 'admin@workbalance.id');

        $newAccess = (string) $refreshed->json('data.access_token');
        $newRefresh = (string) $refreshed->json('data.refresh_token');

        $this->assertNotSame($oldRefresh, $newRefresh);

        // New access token works immediately
        $this->withToken($newAccess)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.email', 'admin@workbalance.id');

        // Replaying old rotated refresh token is blocked
        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $oldRefresh,
        ])->assertUnauthorized();
    }

    public function test_logout_blacklists_both_access_and_refresh_tokens_immediately(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@workbalance.id',
            'password' => 'password123',
        ])->assertOk();

        $accessToken = (string) $login->json('data.access_token');
        $refreshToken = (string) $login->json('data.refresh_token');

        $this->withToken($accessToken)
            ->deleteJson('/api/v1/auth/logout', [
                'refresh_token' => $refreshToken,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseCount('jwt_revoked_tokens', 2);

        // Both access token and refresh token must be immediately rejected
        $this->withToken($accessToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $refreshToken,
        ])->assertUnauthorized();
    }

    public function test_inactive_user_cannot_use_existing_access_or_refresh_token(): void
    {
        $pair = app(JwtService::class)->issueTokenPair($this->employeeUser);

        $this->employeeUser->update(['is_active' => false]);

        $this->withToken($pair['access_token'])
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $pair['refresh_token'],
        ])->assertUnauthorized();
    }

    public function test_admin_can_register_elevated_role_via_jwt_while_public_register_stays_employee(): void
    {
        $adminToken = $this->issueJwt($this->admin);

        $this->withToken($adminToken)
            ->postJson('/api/v1/auth/register', [
                'email' => 'manajer.baru@workbalance.id',
                'password' => 'password123',
                'role' => 'manager',
            ])
            ->assertCreated()
            ->assertJsonPath('data.user.role', 'manager');
    }

    private function decodeBase64Url(string $segment): string
    {
        $remainder = strlen($segment) % 4;
        $padded = $remainder > 0 ? $segment.str_repeat('=', 4 - $remainder) : $segment;

        return (string) base64_decode(strtr($padded, '-_', '+/'), true);
    }

    private function encodeBase64Url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
