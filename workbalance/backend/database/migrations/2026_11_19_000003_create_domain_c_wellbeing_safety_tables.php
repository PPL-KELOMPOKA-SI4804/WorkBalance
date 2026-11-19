<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (Domain C: Kesejahteraan, Suara Pekerja & K3).
     */
    public function up(): void
    {
        Schema::create('work_surveys', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('period_month', 7);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('survey_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_survey_id')->constrained('work_surveys')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->unsignedTinyInteger('work_life_balance_score');
            $table->unsignedTinyInteger('workload_perception_score');
            $table->text('comments')->nullable();
            $table->dateTime('submitted_at');
            $table->timestamps();
        });

        Schema::create('workplace_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reported_by')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->string('category');
            $table->text('description');
            $table->enum('status', ['open', 'in_progress', 'resolved'])->default('open');
            $table->text('resolution_notes')->nullable();
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('safety_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reported_by')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->date('incident_date');
            $table->string('location');
            $table->enum('severity', ['minor', 'moderate', 'severe'])->default('minor');
            $table->text('description');
            $table->enum('status', ['reported', 'investigating', 'resolved'])->default('reported');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('safety_incidents');
        Schema::dropIfExists('workplace_issues');
        Schema::dropIfExists('survey_responses');
        Schema::dropIfExists('work_surveys');
    }
};
