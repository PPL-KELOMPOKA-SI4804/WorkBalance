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

class Pbi04TaskAssignmentManagementTest extends TestCase
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

    public function test_manager_can_list_and_filter_task_assignments_with_summary_metrics(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $engDept = Department::where('code', 'ENG')->firstOrFail();
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();

        $response = $this->withToken($token)
            ->getJson('/api/v1/task-assignments');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.assignments')
            ->assertJsonPath('data.summary.total', 4)
            ->assertJsonPath('data.summary.active', 3)
            ->assertJsonPath('data.summary.completed', 1)
            ->assertJsonPath('data.summary.deadline_pressure_count', 2)
            ->assertJsonPath('data.summary.overloaded_employees_count', 0);

        $this->assertEquals(36.5, $response->json('data.summary.total_active_assigned_hours'));

        // Search filter by employee name
        $this->withToken($token)
            ->getJson('/api/v1/task-assignments?search=Bima')
            ->assertOk()
            ->assertJsonCount(1, 'data.assignments')
            ->assertJsonPath('data.assignments.0.employee.employee_code', 'EMP-004');

        // Filter by employee_id and status
        $this->withToken($token)
            ->getJson("/api/v1/task-assignments?employee_id={$emp3->id}&status=in_progress")
            ->assertOk()
            ->assertJsonCount(1, 'data.assignments');

        // Filter by department_id
        $this->withToken($token)
            ->getJson("/api/v1/task-assignments?department_id={$engDept->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.assignments');

        // Filter by deadline_filter=overdue
        $this->withToken($token)
            ->getJson('/api/v1/task-assignments?deadline_filter=overdue')
            ->assertOk()
            ->assertJsonCount(1, 'data.assignments')
            ->assertJsonPath('data.assignments.0.employee.employee_code', 'EMP-003');

        // Filter by deadline_filter=due_soon
        $this->withToken($token)
            ->getJson('/api/v1/task-assignments?deadline_filter=due_soon')
            ->assertOk()
            ->assertJsonCount(1, 'data.assignments')
            ->assertJsonPath('data.assignments.0.status', 'in_progress');

        // Add 20h active assignment to EMP-003 (28h + 20h = 48h > 40h -> overloaded_employees_count = 1)
        $extraTask = Task::create([
            'department_id' => $engDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Migrasi Layanan Analitik Real-Time',
            'estimated_hours' => 20.00,
            'priority' => 'high',
            'due_date' => now()->addDays(10)->toDateString(),
            'status' => 'open',
        ]);

        TaskAssignment::create([
            'task_id' => $extraTask->id,
            'employee_id' => $emp3->id,
            'assigned_by' => $managerEmployee->id,
            'assigned_at' => now(),
            'deadline' => now()->addDays(10)->toDateString(),
            'status' => 'assigned',
        ]);

        $this->withToken($token)
            ->getJson('/api/v1/task-assignments')
            ->assertOk()
            ->assertJsonPath('data.summary.overloaded_employees_count', 1);
    }

    public function test_manager_can_create_view_update_and_delete_task_assignment(): void
    {
        $token = $this->issueJwt($this->manager);
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        $task = Task::create([
            'department_id' => $engDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Integrasi Eksport Laporan K3',
            'estimated_hours' => 15,
            'priority' => 'medium',
            'due_date' => now()->addDays(8)->toDateString(),
            'status' => 'open',
        ]);

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $task->id,
                'employee_id' => $emp4->id,
                'deadline' => now()->addDays(6)->toDateString(),
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.task_id', $task->id)
            ->assertJsonPath('data.employee_id', $emp4->id)
            ->assertJsonPath('data.assigned_by', $managerEmployee->id)
            ->assertJsonPath('data.status', 'assigned');

        $assignmentId = $createResponse->json('data.id');

        // View detail
        $this->withToken($token)
            ->getJson("/api/v1/task-assignments/{$assignmentId}")
            ->assertOk()
            ->assertJsonPath('data.id', $assignmentId)
            ->assertJsonPath('data.employee.full_name', 'Bima Wijaya');

        // Update deadline and status to in_progress -> parent Task should transition from open to in_progress
        $newDeadline = now()->addDays(4)->toDateString();
        $this->withToken($token)
            ->putJson("/api/v1/task-assignments/{$assignmentId}", [
                'deadline' => $newDeadline,
                'status' => 'in_progress',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.deadline', $newDeadline)
            ->assertJsonPath('data.status', 'in_progress');

        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'status' => 'in_progress',
        ]);

        // Delete assignment without work_logs and not completed
        $this->withToken($token)
            ->deleteJson("/api/v1/task-assignments/{$assignmentId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('task_assignments', ['id' => $assignmentId]);
    }

    public function test_admin_can_create_task_assignment(): void
    {
        $token = $this->issueJwt($this->admin);
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();
        $emp5 = Employee::where('employee_code', 'EMP-005')->firstOrFail();
        $hrdDept = Department::where('code', 'HRD')->firstOrFail();

        $task = Task::create([
            'department_id' => $hrdDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Survei Kesejahteraan Triwulan',
            'estimated_hours' => 6,
            'priority' => 'low',
            'due_date' => now()->addDays(12)->toDateString(),
            'status' => 'open',
        ]);

        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $task->id,
                'employee_id' => $emp5->id,
                'deadline' => now()->addDays(10)->toDateString(),
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.employee.employee_code', 'EMP-005');
    }

    public function test_duplicate_assignment_inactive_employee_cancelled_task_and_validation_are_rejected(): void
    {
        $token = $this->issueJwt($this->manager);
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        // 422 Validation error
        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => 999999,
                'employee_id' => 999999,
                'deadline' => 'not-a-date',
                'status' => 'invalid_status',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['task_id', 'employee_id', 'deadline', 'status']],
            ]);

        // 409 Duplicate (task_id, employee_id)
        $existingAssignment = TaskAssignment::where('employee_id', $emp3->id)->firstOrFail();
        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $existingAssignment->task_id,
                'employee_id' => $emp3->id,
                'deadline' => now()->addDays(5)->toDateString(),
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // 409 Inactive employee
        $inactiveEmployee = Employee::create([
            'department_id' => $engDept->id,
            'position_id' => $emp3->position_id,
            'employment_type_id' => $emp3->employment_type_id,
            'employee_code' => 'EMP-INACTIVE',
            'full_name' => 'Pegawai Nonaktif',
            'join_date' => '2025-01-01',
            'status' => 'inactive',
        ]);

        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $existingAssignment->task_id,
                'employee_id' => $inactiveEmployee->id,
                'deadline' => now()->addDays(5)->toDateString(),
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // 409 Cancelled task
        $cancelledTask = Task::create([
            'department_id' => $engDept->id,
            'created_by' => $managerEmployee->id,
            'title' => 'Tugas Dibatalkan',
            'estimated_hours' => 4,
            'priority' => 'low',
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => 'cancelled',
        ]);

        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $cancelledTask->id,
                'employee_id' => $emp3->id,
                'deadline' => now()->addDays(5)->toDateString(),
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_cannot_delete_completed_assignment_or_assignment_with_work_logs(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        // Completed assignment -> 409
        $completedAssignment = TaskAssignment::where('status', 'completed')->firstOrFail();
        $this->withToken($token)
            ->deleteJson("/api/v1/task-assignments/{$completedAssignment->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Active assignment with recorded WorkLog -> 409
        $activeAssignment = TaskAssignment::where('employee_id', $emp3->id)
            ->where('status', 'assigned')
            ->firstOrFail();

        WorkLog::create([
            'employee_id' => $emp3->id,
            'task_assignment_id' => $activeAssignment->id,
            'work_date' => now()->toDateString(),
            'hours_spent' => 3.5,
            'activity_description' => 'Profiling kueri agregasi mingguan.',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/task-assignments/{$activeAssignment->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_rbac_employee_can_only_view_own_assignments_and_cannot_mutate(): void
    {
        $token = $this->issueJwt($this->employeeUser);
        $ownEmployee = $this->employeeUser->employee;
        $ownAssignment = TaskAssignment::where('employee_id', $ownEmployee->id)->firstOrFail();
        $otherAssignment = TaskAssignment::where('employee_id', '!=', $ownEmployee->id)->firstOrFail();

        // Index only returns own assignments (2 for EMP-003)
        $this->withToken($token)
            ->getJson('/api/v1/task-assignments')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.assignments')
            ->assertJsonPath('data.summary.total', 2);

        // Own detail allowed (200)
        $this->withToken($token)
            ->getJson("/api/v1/task-assignments/{$ownAssignment->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $ownAssignment->id);

        // Other employee detail forbidden (403)
        $this->withToken($token)
            ->getJson("/api/v1/task-assignments/{$otherAssignment->id}")
            ->assertForbidden();

        // Write operations forbidden (403)
        $this->withToken($token)
            ->postJson('/api/v1/task-assignments', [
                'task_id' => $otherAssignment->task_id,
                'employee_id' => $ownEmployee->id,
                'deadline' => now()->addDays(5)->toDateString(),
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/v1/task-assignments/{$ownAssignment->id}", [
                'status' => 'completed',
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->deleteJson("/api/v1/task-assignments/{$ownAssignment->id}")
            ->assertForbidden();
    }

    public function test_rbac_guest_is_unauthorized_for_task_assignments(): void
    {
        $this->getJson('/api/v1/task-assignments')->assertUnauthorized();
        $this->postJson('/api/v1/task-assignments', [])->assertUnauthorized();
    }
}
