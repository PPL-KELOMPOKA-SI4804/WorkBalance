<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use App\Models\WorkLog;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkLogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi09WorkLogManagementTest extends TestCase
{
    use RefreshDatabase;

    private UserAccount $admin;

    private UserAccount $manager;

    private UserAccount $employee1;

    private UserAccount $employee2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
        $this->seed(WorkLogSeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employee1 = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
        $this->employee2 = UserAccount::where('email', 'pegawai2@workbalance.id')->firstOrFail();
    }

    public function test_guest_cannot_access_work_logs_endpoints(): void
    {
        $this->getJson('/api/v1/work-logs')
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');

        $this->postJson('/api/v1/work-logs', [
            'work_date' => now()->toDateString(),
            'hours_spent' => 4,
            'activity_description' => 'Percobaan tanpa token harus ditolak.',
        ])
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_lists_only_own_work_logs_and_assignments_with_estimation_comparison(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;

        $response = $this->withToken($token)
            ->getJson('/api/v1/work-logs');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(3, 'data.work_logs')
            ->assertJsonCount(2, 'data.assignments')
            ->assertJsonPath('data.summary.total_logs', 3)
            ->assertJsonPath('data.summary.overtime_days_count', 0);

        $this->assertEquals(18.0, $response->json('data.summary.total_hours_spent'));
        $this->assertEquals(28.0, $response->json('data.summary.total_estimated_hours'));
        $this->assertEquals(18.0, $response->json('data.summary.total_linked_actual_hours'));
        $this->assertEquals(64.3, $response->json('data.summary.overall_realization_rate'));

        // Verify assignment estimation vs realization breakdown (14h of 16h -> variance -2h, 87.5%)
        $task1Assignment = collect($response->json('data.assignments'))
            ->first(fn ($item) => str_contains($item['task']['title'], 'Autentikasi Sanctum'));

        $this->assertNotNull($task1Assignment);
        $this->assertEquals(16.0, $task1Assignment['estimated_hours']);
        $this->assertEquals(14.0, $task1Assignment['actual_hours']);
        $this->assertEquals(-2.0, $task1Assignment['variance_hours']);
        $this->assertEquals(87.5, $task1Assignment['realization_rate']);
    }

    public function test_employee_can_create_view_update_and_delete_own_work_log_and_auto_start_assignment(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        // Task 2 assignment starts as 'assigned' with task status 'open'
        $assignedItem = TaskAssignment::where('employee_id', $emp3->id)
            ->where('status', 'assigned')
            ->with('task')
            ->firstOrFail();

        $today = now()->toDateString();

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'task_assignment_id' => $assignedItem->id,
                'work_date' => $today,
                'hours_spent' => 3.5,
                'activity_description' => 'Optimasi kueri indeks agregasi laporan mingguan pada MySQL.',
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.employee_id', $emp3->id)
            ->assertJsonPath('data.task_assignment_id', $assignedItem->id);

        $this->assertEquals(3.5, (float) $createResponse->json('data.hours_spent'));

        $createdId = $createResponse->json('data.id');

        // Auto-transition assignment & task from assigned/open to in_progress
        $this->assertDatabaseHas('task_assignments', [
            'id' => $assignedItem->id,
            'status' => 'in_progress',
        ]);
        $this->assertDatabaseHas('tasks', [
            'id' => $assignedItem->task_id,
            'status' => 'in_progress',
        ]);

        // View single own work log
        $this->withToken($token)
            ->getJson("/api/v1/work-logs/{$createdId}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $createdId);

        // Update own work log
        $updateResponse = $this->withToken($token)
            ->putJson("/api/v1/work-logs/{$createdId}", [
                'hours_spent' => 5.0,
                'activity_description' => 'Optimasi indeks agregasi serta verifikasi rencana eksekusi kueri.',
            ]);

        $updateResponse->assertOk()
            ->assertJsonPath('status', 'success');
        $this->assertEquals(5.0, (float) $updateResponse->json('data.hours_spent'));

        // Delete own work log
        $this->withToken($token)
            ->deleteJson("/api/v1/work-logs/{$createdId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('work_logs', ['id' => $createdId]);
    }

    public function test_employee_cannot_view_update_or_delete_other_employees_work_log(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $otherLog = WorkLog::where('employee_id', $emp4->id)->firstOrFail();

        $this->withToken($token)
            ->getJson("/api/v1/work-logs/{$otherLog->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->putJson("/api/v1/work-logs/{$otherLog->id}", [
                'hours_spent' => 2.0,
                'activity_description' => 'Percobaan ubah log milik pegawai lain.',
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/work-logs/{$otherLog->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_cannot_log_work_against_another_employees_task_assignment(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $otherAssignment = TaskAssignment::where('employee_id', $emp4->id)->firstOrFail();

        $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'task_assignment_id' => $otherAssignment->id,
                'work_date' => now()->toDateString(),
                'hours_spent' => 2.0,
                'activity_description' => 'Mencatat jam ke penugasan pegawai lain harus ditolak.',
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_daily_work_hours_exceeding_24_hours_is_rejected_with_conflict(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $targetDate = now()->toDateString(); // EMP-003 already has 4.0h seeded on today

        $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'work_date' => $targetDate,
                'hours_spent' => 21.0,
                'activity_description' => 'Total 25 jam pada tanggal yang sama harus ditolak.',
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_can_view_and_filter_all_work_logs_and_realization_metrics(): void
    {
        $token = $this->manager->createToken('mgr')->plainTextToken;
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $engDept = Department::where('code', 'ENG')->firstOrFail();
        $emp4Assignment = TaskAssignment::where('employee_id', $emp4->id)->firstOrFail();

        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/work-logs');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(5, 'data.work_logs')
            ->assertJsonCount(4, 'data.assignments')
            ->assertJsonPath('data.summary.total_logs', 5)
            ->assertJsonPath('data.summary.overtime_days_count', 1);

        $this->assertEquals(33.0, $listResponse->json('data.summary.total_hours_spent'));

        // Filter by employee_id
        $this->withToken($token)
            ->getJson("/api/v1/work-logs?employee_id={$emp4->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.work_logs')
            ->assertJsonPath('data.work_logs.0.employee.employee_code', 'EMP-004');

        // Filter by department_id (ENG has 3 logs from EMP-003)
        $this->withToken($token)
            ->getJson("/api/v1/work-logs?department_id={$engDept->id}")
            ->assertOk()
            ->assertJsonCount(3, 'data.work_logs');

        // Filter by task_assignment_id
        $this->withToken($token)
            ->getJson("/api/v1/work-logs?task_assignment_id={$emp4Assignment->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.work_logs');

        // Filter by date_from & date_to & search
        $yesterday = now()->subDays(1)->toDateString();
        $this->withToken($token)
            ->getJson("/api/v1/work-logs?date_from={$yesterday}&date_to={$yesterday}&search=eskalasi")
            ->assertOk()
            ->assertJsonCount(1, 'data.work_logs');
    }

    public function test_manager_cannot_create_update_or_delete_work_logs(): void
    {
        $token = $this->manager->createToken('mgr')->plainTextToken;
        $sampleLog = WorkLog::firstOrFail();

        $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'work_date' => now()->toDateString(),
                'hours_spent' => 2.0,
                'activity_description' => 'Manajer tidak boleh mencatat work log langsung.',
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->putJson("/api/v1/work-logs/{$sampleLog->id}", [
                'hours_spent' => 3.0,
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/work-logs/{$sampleLog->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_admin_can_create_update_and_delete_work_log_and_rejects_mismatched_assignment(): void
    {
        $token = $this->admin->createToken('adm')->plainTextToken;
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $emp4Assignment = TaskAssignment::where('employee_id', $emp4->id)->firstOrFail();

        // Mismatch between employee_id and task_assignment_id -> 409
        $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'employee_id' => $emp3->id,
                'task_assignment_id' => $emp4Assignment->id,
                'work_date' => now()->toDateString(),
                'hours_spent' => 2.0,
                'activity_description' => 'Kombinasi pegawai dan penugasan tidak cocok.',
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Valid admin creation for EMP-004 general activity (null assignment)
        $created = $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'employee_id' => $emp4->id,
                'work_date' => now()->toDateString(),
                'hours_spent' => 2.5,
                'activity_description' => 'Sinkronisasi rapat koordinasi lintas tim operasional.',
            ]);

        $created->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.employee_id', $emp4->id);

        $logId = $created->json('data.id');

        $this->withToken($token)
            ->putJson("/api/v1/work-logs/{$logId}", [
                'hours_spent' => 3.0,
                'activity_description' => 'Pembaruan durasi rapat koordinasi lintas tim operasional.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->withToken($token)
            ->deleteJson("/api/v1/work-logs/{$logId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('work_logs', ['id' => $logId]);
    }

    public function test_validation_rejects_invalid_work_log_payloads(): void
    {
        $token = $this->employee2->createToken('emp2')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/work-logs', [
                'task_assignment_id' => 999999,
                'work_date' => '20-11-2026',
                'hours_spent' => 25,
                'activity_description' => 'Ok',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'data' => [
                    'errors' => ['task_assignment_id', 'work_date', 'hours_spent', 'activity_description'],
                ],
            ]);
    }
}
