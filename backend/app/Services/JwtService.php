<?php

namespace App\Services;

use App\Models\JwtRevokedToken;
use App\Models\UserAccount;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class JwtService
{
    public const TYPE_ACCESS = 'access';

    public const TYPE_REFRESH = 'refresh';

    /**
     * Issue a signed HS256 Access Token for the given user account.
     *
     * @return array{token: string, jti: string, expires_in: int, expires_at: int}
     */
    public function issueAccessToken(UserAccount $user, ?int $ttlSeconds = null): array
    {
        $ttl = $ttlSeconds ?? max(60, (int) config('jwt.access_ttl', 3600));

        return $this->issueToken($user, self::TYPE_ACCESS, $ttl);
    }

    /**
     * Issue a signed HS256 Refresh Token for the given user account.
     *
     * @return array{token: string, jti: string, expires_in: int, expires_at: int}
     */
    public function issueRefreshToken(UserAccount $user, ?int $ttlSeconds = null): array
    {
        $ttl = $ttlSeconds ?? max(300, (int) config('jwt.refresh_ttl', 1209600));

        return $this->issueToken($user, self::TYPE_REFRESH, $ttl);
    }

    /**
     * Issue a complete Access + Refresh JWT pair with backwards-compatible `token` alias.
     *
     * @return array{
     *     token: string,
     *     access_token: string,
     *     refresh_token: string,
     *     token_type: string,
     *     expires_in: int,
     *     refresh_expires_in: int
     * }
     */
    public function issueTokenPair(UserAccount $user): array
    {
        $access = $this->issueAccessToken($user);
        $refresh = $this->issueRefreshToken($user);

        return [
            'token' => $access['token'],
            'access_token' => $access['token'],
            'refresh_token' => $refresh['token'],
            'token_type' => 'Bearer',
            'expires_in' => $access['expires_in'],
            'refresh_expires_in' => $refresh['expires_in'],
        ];
    }

    /**
     * Decode, cryptographically verify (HS256), check temporal claims & token type,
     * and verify the token `jti` has not been revoked.
     *
     * @return array<string, mixed>|null
     */
    public function parseAndValidate(string $jwt, string $expectedType = self::TYPE_ACCESS): ?array
    {
        $payload = $this->decodeVerifiedPayload($jwt);
        if ($payload === null) {
            return null;
        }

        $now = now()->timestamp;

        if (($payload['typ'] ?? null) !== $expectedType) {
            return null;
        }

        if (empty($payload['sub']) || empty($payload['jti'])) {
            return null;
        }

        if (! isset($payload['exp']) || ! is_numeric($payload['exp']) || (int) $payload['exp'] <= $now) {
            return null;
        }

        if (isset($payload['nbf']) && is_numeric($payload['nbf']) && (int) $payload['nbf'] > $now) {
            return null;
        }

        if ($this->isRevoked((string) $payload['jti'])) {
            return null;
        }

        return $payload;
    }

    /**
     * Revoke a valid JWT by recording its `jti` in `jwt_revoked_tokens`.
     * Silently ignores malformed or already-revoked tokens so logout stays idempotent.
     */
    public function revokeToken(?string $jwt, ?string $expectedType = null): bool
    {
        if (! is_string($jwt) || trim($jwt) === '') {
            return false;
        }

        $payload = $this->decodeVerifiedPayload($jwt);
        if ($payload === null) {
            return false;
        }

        $tokenType = (string) ($payload['typ'] ?? self::TYPE_ACCESS);
        if ($expectedType !== null && $tokenType !== $expectedType) {
            return false;
        }

        if (! in_array($tokenType, [self::TYPE_ACCESS, self::TYPE_REFRESH], true)) {
            return false;
        }

        $jti = (string) ($payload['jti'] ?? '');
        if ($jti === '') {
            return false;
        }

        $subId = is_numeric($payload['sub'] ?? null) ? (int) $payload['sub'] : null;
        $userExists = $subId !== null && UserAccount::whereKey($subId)->exists();
        $expiresAt = isset($payload['exp']) && is_numeric($payload['exp'])
            ? Carbon::createFromTimestamp((int) $payload['exp'])
            : now()->addHour();

        JwtRevokedToken::firstOrCreate(
            ['jti' => $jti],
            [
                'user_account_id' => $userExists ? $subId : null,
                'token_type' => $tokenType,
                'expires_at' => $expiresAt,
                'revoked_at' => now(),
            ]
        );

        return true;
    }

    /**
     * Validate a refresh token, revoke it (single-use rotation), and return a fresh
     * token pair along with the authenticated active UserAccount.
     *
     * @return array{user: UserAccount, tokens: array<string, mixed>}|null
     */
    public function rotateRefreshToken(string $refreshJwt): ?array
    {
        $payload = $this->parseAndValidate($refreshJwt, self::TYPE_REFRESH);
        if ($payload === null) {
            return null;
        }

        $user = UserAccount::with(['employee.department', 'employee.position', 'employee.employmentType'])
            ->find((int) $payload['sub']);

        if (! $user || ! $user->is_active) {
            return null;
        }

        return DB::transaction(function () use ($refreshJwt, $payload, $user): ?array {
            // Re-check revocation inside transaction to prevent concurrent replay
            if ($this->isRevoked((string) $payload['jti'])) {
                return null;
            }

            $this->revokeToken($refreshJwt, self::TYPE_REFRESH);

            return [
                'user' => $user,
                'tokens' => $this->issueTokenPair($user),
            ];
        });
    }

    public function isRevoked(string $jti): bool
    {
        return JwtRevokedToken::query()
            ->where('jti', $jti)
            ->exists();
    }

    /**
     * @return array{token: string, jti: string, expires_in: int, expires_at: int}
     */
    private function issueToken(UserAccount $user, string $type, int $ttl): array
    {
        $now = now()->timestamp;
        $exp = $now + $ttl;
        $jti = (string) Str::uuid();

        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT',
        ];

        $payload = [
            'iss' => (string) config('jwt.issuer', config('app.url', 'http://localhost:8000')),
            'sub' => (string) $user->id,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $exp,
            'jti' => $jti,
            'typ' => $type,
            'role' => $user->role,
            'email' => $user->email,
        ];

        $encodedHeader = $this->base64UrlEncode((string) json_encode($header, JSON_THROW_ON_ERROR));
        $encodedPayload = $this->base64UrlEncode((string) json_encode($payload, JSON_THROW_ON_ERROR));
        $signingInput = $encodedHeader.'.'.$encodedPayload;
        $signature = $this->sign($signingInput);

        return [
            'token' => $signingInput.'.'.$this->base64UrlEncode($signature),
            'jti' => $jti,
            'expires_in' => $ttl,
            'expires_at' => $exp,
        ];
    }

    /**
     * Decode and cryptographically verify an HS256 JWT without enforcing expiration
     * (used by both validation and idempotent logout revocation).
     *
     * @return array<string, mixed>|null
     */
    private function decodeVerifiedPayload(string $jwt): ?array
    {
        $segments = explode('.', trim($jwt));
        if (count($segments) !== 3) {
            return null;
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $segments;
        if ($encodedHeader === '' || $encodedPayload === '' || $encodedSignature === '') {
            return null;
        }

        $headerJson = $this->base64UrlDecode($encodedHeader);
        $payloadJson = $this->base64UrlDecode($encodedPayload);
        $signature = $this->base64UrlDecode($encodedSignature);

        if ($headerJson === null || $payloadJson === null || $signature === null) {
            return null;
        }

        $header = json_decode($headerJson, true);
        $payload = json_decode($payloadJson, true);

        if (! is_array($header) || ! is_array($payload)) {
            return null;
        }

        // Strict algorithm pinning: explicitly reject `alg: none` or unexpected algorithms
        if (($header['alg'] ?? null) !== 'HS256' || ($header['typ'] ?? null) !== 'JWT') {
            return null;
        }

        $expectedSignature = $this->sign($encodedHeader.'.'.$encodedPayload);
        if (! hash_equals($expectedSignature, $signature)) {
            return null;
        }

        return $payload;
    }

    private function sign(string $signingInput): string
    {
        return hash_hmac('sha256', $signingInput, $this->resolveSigningKey(), true);
    }

    private function resolveSigningKey(): string
    {
        $configuredSecret = config('jwt.secret');
        if (is_string($configuredSecret) && trim($configuredSecret) !== '') {
            return trim($configuredSecret);
        }

        $appKey = (string) config('app.key', '');
        if ($appKey === '') {
            throw new RuntimeException('JWT signing key is not configured (set JWT_SECRET or APP_KEY).');
        }

        return hash('sha256', $appKey.'|workbalance-jwt-hs256', true);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): ?string
    {
        if (! preg_match('/^[A-Za-z0-9\-_]+$/', $data)) {
            return null;
        }

        $remainder = strlen($data) % 4;
        if ($remainder === 1) {
            return null;
        }

        $padded = $remainder > 0 ? $data.str_repeat('=', 4 - $remainder) : $data;
        $decoded = base64_decode(strtr($padded, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
