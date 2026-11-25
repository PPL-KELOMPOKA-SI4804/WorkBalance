<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use App\Models\WorkLog;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi03TaskManagementTest extends TestCase
{
    use RefreshDatabase;

    private UserAccount $admin;

    private UserAccount $manager;

    private UserAccount $employeeUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employeeUser = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
    }

    public function test_manager_can_list_and_filter_tasks_with_summary_metrics(): void
    {
        $token = $this->issueJwt($this->manager);
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        $response = $this->withToken($token)
            ->getJson('/api/v1/tasks');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.tasks')
            ->assertJsonPath('data.summary.total', 4)
            ->assertJsonPath('data.summary.active', 3)
            ->assertJsonPath('data.summary.completed', 1)
            ->assertJsonPath('data.summary.deadline_pressure_count', 2);

        $this->assertEquals(36.5, $response->json('data.summary.total_active_estimated_hours'));

        // Search filter
        $this->withToken($token)
            ->getJson('/api/v1/tasks?search=Sanctum')
            ->assertOk()
            ->assertJsonCount(1, 'data.tasks')
            ->assertJsonPath('data.tasks.0.priority', 'critical');

        // Department & status filter
        $this->withToken($token)
            ->getJson("/api/v1/tasks?department_id={$engDept->id}&status=open")
            ->assertOk()
            ->assertJsonCount(1, 'data.tasks')
            ->assertJsonPath('data.tasks.0.priority', 'high');

        // Priority filter
        $this->withToken($token)
            ->getJson('/api/v1/tasks?priority=medium')
            ->assertOk()
            ->assertJsonCount(1, 'data.tasks');

        // Due filter: overdue
        $this->withToken($token)
            ->getJson('/api/v1/tasks?due_filter=overdue')
            ->assertOk()
            ->assertJsonCount(1, 'data.tasks')
            ->assertJsonPath('data.tasks.0.priority', 'high');

        // Due filter: due_soon (today..today+7)
        $this->withToken($token)
            ->getJson('/api/v1/tasks?due_filter=due_soon')
            ->assertOk()
            ->assertJsonCount(1, 'data.tasks')
            ->assertJsonPath('data.tasks.0.priority', 'critical');
    }

    public function test_manager_can_create_view_update_and_delete_task(): void
    {
        $token = $this->issueJwt($this->manager);
        $opsDept = Department::where('code', 'OPS')->firstOrFail();
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/tasks', [
                'department_id' => $opsDept->id,
                'title' => 'Rekonsiliasi Jadwal Shift Bulanan',
                'description' => 'Memeriksa batas 40 jam kerja dan distribusi shift malam.',
                'estimated_hours' => 10.5,
                'priority' => 'high',
                'due_date' => now()->addDays(5)->toDateString(),
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'Rekonsiliasi Jadwal Shift Bulanan')
            ->assertJsonPath('data.created_by', $managerEmployee->id)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.priority', 'high')
            ->assertJsonPath('data.department.code', 'OPS');

        $taskId = $createResponse->json('data.id');

        // View single task
        $this->withToken($token)
            ->getJson("/api/v1/tasks/{$taskId}")
            ->assertOk()
            ->assertJsonPath('data.id', $taskId)
            ->assertJsonPath('data.creator.full_name', 'Raka Pratama');

        // Update task
        $this->withToken($token)
            ->putJson("/api/v1/tasks/{$taskId}", [
                'title' => 'Rekonsiliasi Jadwal Shift & Lembur',
                'estimated_hours' => 14,
                'priority' => 'critical',
                'status' => 'in_progress',
                'due_date' => now()->addDays(4)->toDateString(),
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'Rekonsiliasi Jadwal Shift & Lembur')
            ->assertJsonPath('data.priority', 'critical')
            ->assertJsonPath('data.status', 'in_progress');

        // Delete task without active assignment/worklog
        $this->withToken($token)
            ->deleteJson("/api/v1/tasks/{$taskId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('tasks', ['id' => $taskId]);
    }

    public function test_admin_can_create_task(): void
    {
        $token = $this->issueJwt($this->admin);
        $hrdDept = Department::where('code', 'HRD')->firstOrFail();

        $this->withToken($token)
            ->postJson('/api/v1/tasks', [
                'department_id' => $hrdDept->id,
                'title' => 'Evaluasi Kepatuhan Cuti Tahunan',
                'estimated_hours' => 5,
                'priority' => 'low',
                'due_date' => now()->addDays(10)->toDateString(),
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.department.code', 'HRD');
    }

    public function test_task_validation_rejects_invalid_hours_priority_status_and_department(): void
    {
        $token = $this->issueJwt($this->manager);
        $engDept = Department::where('code', 'ENG')->firstOrFail();
        $existingTask = Task::firstOrFail();

        $this->withToken($token)
            ->postJson('/api/v1/tasks', [
                'department_id' => 999999,
                'title' => '',
                'estimated_hours' => 0,
                'priority' => 'urgent',
                'due_date' => 'not-a-date',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['department_id', 'title', 'estimated_hours', 'priority', 'due_date']],
            ]);

        $this->withToken($token)
            ->putJson("/api/v1/tasks/{$existingTask->id}", [
                'department_id' => $engDept->id,
                'estimated_hours' => -3,
                'status' => 'archived',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['estimated_hours', 'status']],
            ]);
    }

    public function test_cannot_delete_task_with_active_assignments_or_recorded_work_logs(): void
    {
        $token = $this->issueJwt($this->manager);
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();
        $assignee = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        // Case 1: Active/in_progress assignment
        $taskWithActiveAssignment = Task::create([
            'department_id' => $engDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Tugas Dengan Penugasan Berjalan',
            'estimated_hours' => 8,
            'priority' => 'high',
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'in_progress',
        ]);

        TaskAssignment::create([
            'task_id' => $taskWithActiveAssignment->id,
            'employee_id' => $assignee->id,
            'assigned_by' => $managerEmployee->id,
            'assigned_at' => now(),
            'deadline' => now()->addDays(4)->toDateString(),
            'status' => 'in_progress',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/tasks/{$taskWithActiveAssignment->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Case 2: Assignment still 'assigned' but already has recorded WorkLog
        $taskWithWorkLog = Task::create([
            'department_id' => $engDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Tugas Dengan Work Log',
            'estimated_hours' => 6,
            'priority' => 'medium',
            'due_date' => now()->addDays(6)->toDateString(),
            'status' => 'open',
        ]);

        $assignment = TaskAssignment::create([
            'task_id' => $taskWithWorkLog->id,
            'employee_id' => $assignee->id,
            'assigned_by' => $managerEmployee->id,
            'assigned_at' => now(),
            'deadline' => now()->addDays(6)->toDateString(),
            'status' => 'assigned',
        ]);

        WorkLog::create([
            'employee_id' => $assignee->id,
            'task_assignment_id' => $assignment->id,
            'work_date' => now()->toDateString(),
            'hours_spent' => 2.5,
            'activity_description' => 'Investigasi awal modul.',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/tasks/{$taskWithWorkLog->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_rbac_employee_has_read_only_access_to_tasks(): void
    {
        $token = $this->issueJwt($this->employeeUser);
        $engDept = Department::where('code', 'ENG')->firstOrFail();
        $task = Task::firstOrFail();

        $this->withToken($token)
            ->getJson('/api/v1/tasks')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.tasks');

        $this->withToken($token)
            ->getJson("/api/v1/tasks/{$task->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $task->id);

        $this->withToken($token)
            ->postJson('/api/v1/tasks', [
                'department_id' => $engDept->id,
                'title' => 'Blocked Employee Task',
                'estimated_hours' => 4,
                'priority' => 'low',
                'due_date' => now()->addDays(3)->toDateString(),
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/v1/tasks/{$task->id}", [
                'title' => 'Blocked Update',
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->deleteJson("/api/v1/tasks/{$task->id}")
            ->assertForbidden();
    }

    public function test_rbac_guest_is_unauthorized_for_tasks(): void
    {
        $this->getJson('/api/v1/tasks')->assertUnauthorized();
        $this->postJson('/api/v1/tasks', [])->assertUnauthorized();
    }
}
