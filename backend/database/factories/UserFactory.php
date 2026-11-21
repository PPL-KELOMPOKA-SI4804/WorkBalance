<?php

namespace Database\Factories;

use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<UserAccount>
 */
class UserFactory extends Factory
{
    protected $model = UserAccount::class;

    protected static ?string $password;

    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'password_hash' => static::$password ??= Hash::make('password123'),
            'role' => 'employee',
            'is_active' => true,
            'remember_token' => Str::random(10),
        ];
    }
}
