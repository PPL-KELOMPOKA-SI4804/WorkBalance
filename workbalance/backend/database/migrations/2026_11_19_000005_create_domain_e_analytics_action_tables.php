<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (Domain E: Analitik, Rekomendasi & Jejak Audit Tindak Lanjut).
     */
    public function up(): void
    {
        Schema::create('workload_risks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('period_week', 10);
            $table->string('period_month', 7);
            $table->decimal('weekly_hours_score', 5, 2);
            $table->decimal('overtime_score', 5, 2);
            $table->decimal('task_load_score', 5, 2);
            $table->decimal('deadline_pressure_score', 5, 2);
            $table->decimal('final_score', 5, 2);
            $table->enum('risk_category', ['low', 'medium', 'high'])->default('low');
            $table->boolean('is_overridden')->default(false);
            $table->timestamps();
        });

        Schema::create('decent_work_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->string('period_month', 7);
            $table->decimal('dim_workload_score', 5, 2);
            $table->decimal('dim_wlb_score', 5, 2);
            $table->decimal('dim_compensation_score', 5, 2);
            $table->decimal('dim_safety_score', 5, 2);
            $table->decimal('dim_voice_score', 5, 2);
            $table->decimal('dim_competency_score', 5, 2);
            $table->decimal('final_score', 5, 2);
            $table->enum('status_category', ['good', 'needs_attention', 'action_priority'])->default('good');
            $table->timestamps();
        });

        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();
            $table->enum('target_type', ['employee', 'department']);
            $table->unsignedBigInteger('target_id');
            $table->string('period', 10);
            $table->string('trigger_source');
            $table->string('title');
            $table->text('suggested_action');
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->boolean('is_adopted')->default(false);
            $table->timestamps();
        });

        Schema::create('improvement_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recommendation_id')->nullable()->constrained('recommendations')->nullOnDelete();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->foreignId('pic_employee_id')->constrained('employees')->restrictOnDelete();
            $table->string('title');
            $table->text('action_plan');
            $table->date('due_date');
            $table->enum('status', ['planned', 'in_progress', 'completed', 'cancelled'])->default('planned');
            $table->timestamps();
        });

        Schema::create('action_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('improvement_action_id')->constrained('improvement_actions')->cascadeOnDelete();
            $table->foreignId('updated_by')->constrained('employees')->restrictOnDelete();
            $table->string('previous_status')->nullable();
            $table->string('new_status');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('action_updates');
        Schema::dropIfExists('improvement_actions');
        Schema::dropIfExists('recommendations');
        Schema::dropIfExists('decent_work_scores');
        Schema::dropIfExists('workload_risks');
    }
};
