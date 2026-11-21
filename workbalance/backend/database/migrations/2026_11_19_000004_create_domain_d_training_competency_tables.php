<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (Domain D: Pelatihan & Kompetensi).
     */
    public function up(): void
    {
        Schema::create('trainings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category');
            $table->string('provider');
            $table->decimal('duration_hours', 6, 2);
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamps();
        });

        Schema::create('training_participations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_id')->constrained('trainings')->restrictOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->enum('status', ['enrolled', 'completed', 'dropped'])->default('enrolled');
            $table->date('completion_date')->nullable();
            $table->timestamps();
        });

        Schema::create('competencies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_competencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('competency_id')->constrained('competencies')->restrictOnDelete();
            $table->unsignedTinyInteger('current_level');
            $table->unsignedTinyInteger('target_level');
            $table->dateTime('last_assessed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_competencies');
        Schema::dropIfExists('competencies');
        Schema::dropIfExists('training_participations');
        Schema::dropIfExists('trainings');
    }
};
