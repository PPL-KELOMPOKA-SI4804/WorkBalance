<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (Domain B: Tugas & Aktivitas Kerja).
     */
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('employees')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('estimated_hours', 8, 2);
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->date('due_date');
            $table->enum('status', ['open', 'in_progress', 'completed', 'cancelled'])->default('open');
            $table->timestamps();
        });

        Schema::create('task_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('assigned_by')->constrained('employees')->restrictOnDelete();
            $table->dateTime('assigned_at');
            $table->date('deadline');
            $table->enum('status', ['assigned', 'in_progress', 'completed'])->default('assigned');
            $table->timestamps();
        });

        Schema::create('work_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('task_assignment_id')->nullable()->constrained('task_assignments')->nullOnDelete();
            $table->date('work_date');
            $table->decimal('hours_spent', 5, 2);
            $table->text('activity_description');
            $table->timestamps();
        });

        Schema::create('overtimes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('overtime_date');
            $table->decimal('duration_hours', 5, 2);
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('leave_type');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('total_hours', 6, 2);
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('compensations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('period_month', 7);
            $table->decimal('base_salary', 15, 2)->default(0);
            $table->decimal('allowances', 15, 2)->default(0);
            $table->decimal('benefits', 15, 2)->default(0);
            $table->boolean('is_complete')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('compensations');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('overtimes');
        Schema::dropIfExists('work_logs');
        Schema::dropIfExists('task_assignments');
        Schema::dropIfExists('tasks');
    }
};
