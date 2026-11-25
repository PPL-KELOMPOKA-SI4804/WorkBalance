<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('jwt_revoked_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('jti', 64)->unique();
            $table->foreignId('user_account_id')
                ->nullable()
                ->constrained('user_accounts')
                ->cascadeOnDelete();
            $table->enum('token_type', ['access', 'refresh'])->default('access');
            $table->dateTime('expires_at')->index();
            $table->dateTime('revoked_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jwt_revoked_tokens');
    }
};
