<?php

return [
    /*
    |--------------------------------------------------------------------------
    | JWT Signing Secret & Algorithm (RFC 7519 HS256)
    |--------------------------------------------------------------------------
    |
    | Uses JWT_SECRET when set, or falls back to a deterministic SHA-256 key
    | derived from APP_KEY so development and isolated PHPUnit runs work out
    | of the box without manual secret generation.
    |
    */
    'secret' => env('JWT_SECRET'),

    'algo' => 'HS256',

    'issuer' => env('JWT_ISSUER', env('APP_URL', 'http://localhost:8000')),

    // Access token lifetime in seconds (default: 60 minutes)
    'access_ttl' => (int) env('JWT_ACCESS_TTL', 3600),

    // Refresh token lifetime in seconds (default: 14 days)
    'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 1209600),
];
