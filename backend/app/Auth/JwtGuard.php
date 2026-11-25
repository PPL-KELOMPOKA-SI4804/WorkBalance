<?php

namespace App\Auth;

use App\Models\UserAccount;
use App\Services\JwtService;
use Illuminate\Auth\GuardHelpers;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Http\Request;

class JwtGuard implements Guard
{
    use GuardHelpers;

    private Request $request;

    private JwtService $jwtService;

    private ?Request $resolvedForRequest = null;

    /**
     * @var array<string, mixed>|null
     */
    private ?array $payload = null;

    private bool $manuallySet = false;

    public function __construct(UserProvider $provider, Request $request, JwtService $jwtService)
    {
        $this->provider = $provider;
        $this->request = $request;
        $this->jwtService = $jwtService;
    }

    public function setRequest(Request $request): self
    {
        $this->request = $request;
        $this->user = null;
        $this->payload = null;
        $this->resolvedForRequest = null;
        $this->manuallySet = false;

        return $this;
    }

    public function setUser(Authenticatable $user): self
    {
        $this->user = $user;
        $this->manuallySet = true;
        $this->resolvedForRequest = $this->request;

        return $this;
    }

    public function user(): ?Authenticatable
    {
        if ($this->manuallySet && $this->user !== null) {
            return $this->user;
        }

        if ($this->resolvedForRequest === $this->request) {
            return $this->user;
        }

        $this->resolvedForRequest = $this->request;
        $this->user = null;
        $this->payload = null;

        $bearerToken = $this->request->bearerToken();
        if (! is_string($bearerToken) || trim($bearerToken) === '') {
            return null;
        }

        $payload = $this->jwtService->parseAndValidate($bearerToken, JwtService::TYPE_ACCESS);
        if ($payload === null) {
            return null;
        }

        $user = $this->provider->retrieveById((int) $payload['sub']);
        if (! $user instanceof UserAccount || ! $user->is_active) {
            return null;
        }

        $this->payload = $payload;
        $this->user = $user;
        $this->request->attributes->set('jwt_payload', $payload);

        return $this->user;
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    public function validate(array $credentials = []): bool
    {
        $token = $credentials['token'] ?? null;
        if (! is_string($token) || trim($token) === '') {
            return false;
        }

        $payload = $this->jwtService->parseAndValidate($token, JwtService::TYPE_ACCESS);
        if ($payload === null) {
            return false;
        }

        $user = $this->provider->retrieveById((int) $payload['sub']);

        return $user instanceof UserAccount && $user->is_active;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function payload(): ?array
    {
        $this->user();

        return $this->payload;
    }
}
