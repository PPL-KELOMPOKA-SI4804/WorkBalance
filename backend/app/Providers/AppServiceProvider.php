<?php

namespace App\Providers;

use App\Auth\JwtGuard;
use App\Services\JwtService;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(JwtService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Auth::extend('jwt', function (Application $app, string $name, array $config): JwtGuard {
            $provider = Auth::createUserProvider($config['provider'] ?? null);
            $guard = new JwtGuard(
                $provider,
                $app->make('request'),
                $app->make(JwtService::class)
            );

            $app->refresh('request', $guard, 'setRequest');

            return $guard;
        });
    }
}
