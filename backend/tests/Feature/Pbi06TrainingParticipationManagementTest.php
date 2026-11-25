<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Training;
use App\Models\TrainingParticipation;
use App\Models\UserAccount;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\TrainingParticipationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi06TrainingParticipationManagementTest extends TestCase
{
    use RefreshDatabase;

    private UserAccount $admin;

    private UserAccount $manager;

    private UserAccount $employeeUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
        $this->seed(TrainingParticipationSeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employeeUser = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
    }

    public function test_admin_can_list_and_filter_participations_with_summary_metrics(): void
    {
        $token = $this->issueJwt($this->admin);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $opsDept = Department::where('code', 'OPS')->firstOrFail();
        $k3Training = Training::where('title', 'Keselamatan & Kesehatan Kerja (K3) Lingkungan Operasional')->firstOrFail();

        $response = $this->withToken($token)
            ->getJson('/api/v1/training-participations');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.participations')
            ->assertJsonPath('data.summary.total', 4)
            ->assertJsonPath('data.summary.enrolled', 2)
            ->assertJsonPath('data.summary.completed', 1)
            ->assertJsonPath('data.summary.dropped', 1)
            ->assertJsonPath('data.summary.trained_employees_count', 2);

        $this->assertEquals(40.0, $response->json('data.summary.training_coverage_rate'));

        // Search filter
        $this->withToken($token)
            ->getJson('/api/v1/training-participations?search=Bima')
            ->assertOk()
            ->assertJsonCount(1, 'data.participations')
            ->assertJsonPath('data.participations.0.employee.employee_code', 'EMP-004');

        // Filter by training_id
        $this->withToken($token)
            ->getJson("/api/v1/training-participations?training_id={$k3Training->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.participations');

        // Filter by employee_id and status
        $this->withToken($token)
            ->getJson("/api/v1/training-participations?employee_id={$emp3->id}&status=completed")
            ->assertOk()
            ->assertJsonCount(1, 'data.participations');

        // Filter by department_id (OPS has EMP-004 and EMP-005)
        $this->withToken($token)
            ->getJson("/api/v1/training-participations?department_id={$opsDept->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.participations');
    }

    public function test_admin_can_enroll_view_update_completion_and_delete_participation(): void
    {
        $token = $this->issueJwt($this->admin);
        $emp5 = Employee::where('employee_code', 'EMP-005')->firstOrFail();
        $t1 = Training::where('title', 'Arsitektur Sistem Terdistribusi & Optimasi Database')->firstOrFail();

        // Enroll
        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => $t1->id,
                'employee_id' => $emp5->id,
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.training_id', $t1->id)
            ->assertJsonPath('data.employee_id', $emp5->id)
            ->assertJsonPath('data.status', 'enrolled')
            ->assertJsonPath('data.completion_date', null);

        $participationId = $createResponse->json('data.id');

        // View detail
        $this->withToken($token)
            ->getJson("/api/v1/training-participations/{$participationId}")
            ->assertOk()
            ->assertJsonPath('data.employee.full_name', 'Citra Lestari');

        // Mark completed without explicit completion_date -> should auto-populate today's date
        $this->withToken($token)
            ->putJson("/api/v1/training-participations/{$participationId}", [
                'status' => 'completed',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.completion_date', now()->toDateString());

        // Revert to dropped -> completion_date must become null
        $this->withToken($token)
            ->putJson("/api/v1/training-participations/{$participationId}", [
                'status' => 'dropped',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'dropped')
            ->assertJsonPath('data.completion_date', null);

        // Delete dropped participation
        $this->withToken($token)
            ->deleteJson("/api/v1/training-participations/{$participationId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('training_participations', ['id' => $participationId]);
    }

    public function test_manager_can_enroll_update_and_delete_participation(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $t4 = Training::where('title', 'Manajemen Stres & Keseimbangan Kerja-Hidup (Work-Life Balance)')->firstOrFail();

        $this->withToken($token)
            ->getJson('/api/v1/training-participations')
            ->assertOk()
            ->assertJsonCount(4, 'data.participations');

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => $t4->id,
                'employee_id' => $emp4->id,
                'status' => 'enrolled',
            ]);

        $createResponse->assertCreated();
        $id = $createResponse->json('data.id');

        $this->withToken($token)
            ->putJson("/api/v1/training-participations/{$id}", [
                'status' => 'dropped',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'dropped');

        $this->withToken($token)
            ->deleteJson("/api/v1/training-participations/{$id}")
            ->assertOk();
    }

    public function test_duplicate_enrollment_inactive_employee_and_invalid_inputs_are_rejected(): void
    {
        $token = $this->issueJwt($this->admin);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $existing = TrainingParticipation::where('employee_id', $emp3->id)->firstOrFail();

        // 422 Validation error
        $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => 999999,
                'employee_id' => 999999,
                'status' => 'invalid_status',
                'completion_date' => 'not-a-date',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['training_id', 'employee_id', 'status', 'completion_date']],
            ]);

        // 409 Duplicate enrollment (training_id, employee_id)
        $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => $existing->training_id,
                'employee_id' => $emp3->id,
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // 409 Inactive employee
        $inactiveEmployee = Employee::create([
            'department_id' => $emp3->department_id,
            'position_id' => $emp3->position_id,
            'employment_type_id' => $emp3->employment_type_id,
            'employee_code' => 'EMP-OFF',
            'full_name' => 'Pegawai Nonaktif Training',
            'join_date' => '2025-01-01',
            'status' => 'inactive',
        ]);

        $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => $existing->training_id,
                'employee_id' => $inactiveEmployee->id,
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_cannot_delete_completed_training_participation(): void
    {
        $token = $this->issueJwt($this->admin);
        $completed = TrainingParticipation::where('status', 'completed')->firstOrFail();

        $this->withToken($token)
            ->deleteJson("/api/v1/training-participations/{$completed->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('training_participations', ['id' => $completed->id]);
    }

    public function test_rbac_employee_can_only_view_own_participations_and_cannot_mutate(): void
    {
        $token = $this->issueJwt($this->employeeUser);
        $ownEmployee = $this->employeeUser->employee;
        $ownParticipation = TrainingParticipation::where('employee_id', $ownEmployee->id)->firstOrFail();
        $otherParticipation = TrainingParticipation::where('employee_id', '!=', $ownEmployee->id)->firstOrFail();

        // Index only returns own 2 participations
        $this->withToken($token)
            ->getJson('/api/v1/training-participations')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.participations')
            ->assertJsonPath('data.summary.total', 2)
            ->assertJsonPath('data.summary.enrolled', 1)
            ->assertJsonPath('data.summary.completed', 1);

        // Own detail allowed (200)
        $this->withToken($token)
            ->getJson("/api/v1/training-participations/{$ownParticipation->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $ownParticipation->id);

        // Other employee detail forbidden (403)
        $this->withToken($token)
            ->getJson("/api/v1/training-participations/{$otherParticipation->id}")
            ->assertForbidden();

        // Write operations forbidden (403)
        $this->withToken($token)
            ->postJson('/api/v1/training-participations', [
                'training_id' => $otherParticipation->training_id,
                'employee_id' => $ownEmployee->id,
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/v1/training-participations/{$ownParticipation->id}", [
                'status' => 'completed',
            ])
            ->assertForbidden();

        $this->withToken($token)
            ->deleteJson("/api/v1/training-participations/{$ownParticipation->id}")
            ->assertForbidden();
    }

    public function test_rbac_guest_is_unauthorized_for_training_participations(): void
    {
        $this->getJson('/api/v1/training-participations')->assertUnauthorized();
        $this->postJson('/api/v1/training-participations', [])->assertUnauthorized();
    }
}
