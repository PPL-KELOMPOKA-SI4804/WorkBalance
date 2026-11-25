<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Training;
use App\Models\TrainingParticipation;
use App\Models\UserAccount;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi05TrainingCatalogManagementTest extends TestCase
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

    public function test_admin_can_list_and_filter_trainings_with_summary_metrics(): void
    {
        $token = $this->issueJwt($this->admin);

        $response = $this->withToken($token)
            ->getJson('/api/v1/trainings');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.trainings')
            ->assertJsonCount(4, 'data.categories')
            ->assertJsonPath('data.summary.total', 4)
            ->assertJsonPath('data.summary.ongoing', 1)
            ->assertJsonPath('data.summary.upcoming', 2)
            ->assertJsonPath('data.summary.ended', 1)
            ->assertJsonPath('data.summary.total_participations', 0);

        $this->assertEquals(42.0, $response->json('data.summary.total_duration_hours'));

        // Search filter
        $this->withToken($token)
            ->getJson('/api/v1/trainings?search=Balai%20K3')
            ->assertOk()
            ->assertJsonCount(1, 'data.trainings')
            ->assertJsonPath('data.trainings.0.category', 'Keselamatan & K3');

        // Category filter
        $this->withToken($token)
            ->getJson('/api/v1/trainings?category='.urlencode('Teknis & Rekayasa'))
            ->assertOk()
            ->assertJsonCount(1, 'data.trainings');

        // Schedule status filters
        $this->withToken($token)
            ->getJson('/api/v1/trainings?schedule_status=ongoing')
            ->assertOk()
            ->assertJsonCount(1, 'data.trainings');

        $this->withToken($token)
            ->getJson('/api/v1/trainings?schedule_status=upcoming')
            ->assertOk()
            ->assertJsonCount(2, 'data.trainings');

        $this->withToken($token)
            ->getJson('/api/v1/trainings?schedule_status=ended')
            ->assertOk()
            ->assertJsonCount(1, 'data.trainings');
    }

    public function test_admin_can_create_view_update_and_delete_training(): void
    {
        $token = $this->issueJwt($this->admin);

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/trainings', [
                'title' => 'Pengenalan Ergonomi Kerja Kantor',
                'category' => 'Keselamatan & K3',
                'provider' => 'Pusat K3 Terpadu',
                'duration_hours' => 4.5,
                'start_date' => now()->addDays(20)->toDateString(),
                'end_date' => now()->addDays(21)->toDateString(),
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'Pengenalan Ergonomi Kerja Kantor')
            ->assertJsonPath('data.provider', 'Pusat K3 Terpadu')
            ->assertJsonPath('data.participations_count', 0);

        $trainingId = $createResponse->json('data.id');

        // Show detail
        $this->withToken($token)
            ->getJson("/api/v1/trainings/{$trainingId}")
            ->assertOk()
            ->assertJsonPath('data.id', $trainingId)
            ->assertJsonPath('data.category', 'Keselamatan & K3');

        // Update training
        $this->withToken($token)
            ->putJson("/api/v1/trainings/{$trainingId}", [
                'title' => 'Ergonomi Kerja & Pencegahan Burnout',
                'duration_hours' => 6,
                'start_date' => now()->addDays(22)->toDateString(),
                'end_date' => now()->addDays(23)->toDateString(),
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'Ergonomi Kerja & Pencegahan Burnout');

        // Delete training without participations
        $this->withToken($token)
            ->deleteJson("/api/v1/trainings/{$trainingId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('trainings', ['id' => $trainingId]);
    }

    public function test_manager_can_list_create_update_and_delete_training(): void
    {
        $token = $this->issueJwt($this->manager);

        $this->withToken($token)
            ->getJson('/api/v1/trainings')
            ->assertOk()
            ->assertJsonCount(4, 'data.trainings');

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/trainings', [
                'title' => 'Workshop Perencanaan Kapasitas Sprint',
                'category' => 'Kepemimpinan & Manajemen',
                'provider' => 'Agile WorkBalance Lab',
                'duration_hours' => 8,
                'start_date' => now()->addDays(10)->toDateString(),
                'end_date' => now()->addDays(10)->toDateString(),
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('data.title', 'Workshop Perencanaan Kapasitas Sprint');

        $trainingId = $createResponse->json('data.id');

        $this->withToken($token)
            ->putJson("/api/v1/trainings/{$trainingId}", [
                'provider' => 'WorkBalance Learning Center',
            ])
            ->assertOk()
            ->assertJsonPath('data.provider', 'WorkBalance Learning Center');

        $this->withToken($token)
            ->deleteJson("/api/v1/trainings/{$trainingId}")
            ->assertOk();
    }

    public function test_training_validation_rejects_invalid_dates_duration_and_missing_fields(): void
    {
        $token = $this->issueJwt($this->admin);
        $existingTraining = Training::firstOrFail();

        // Store with missing fields, duration <= 0, and end_date < start_date
        $this->withToken($token)
            ->postJson('/api/v1/trainings', [
                'title' => '',
                'category' => '',
                'provider' => '',
                'duration_hours' => 0,
                'start_date' => '2026-12-10',
                'end_date' => '2026-12-05',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['title', 'category', 'provider', 'duration_hours', 'end_date']],
            ]);

        // Partial update setting end_date earlier than existing start_date must fail (422)
        $this->withToken($token)
            ->putJson("/api/v1/trainings/{$existingTraining->id}", [
                'end_date' => $existingTraining->start_date->copy()->subDay()->toDateString(),
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['end_date']],
            ]);
    }

    public function test_cannot_delete_training_referenced_by_employee_participations(): void
    {
        $token = $this->issueJwt($this->admin);
        $training = Training::firstOrFail();
        $employee = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        TrainingParticipation::create([
            'training_id' => $training->id,
            'employee_id' => $employee->id,
            'status' => 'enrolled',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/trainings/{$training->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('trainings', ['id' => $training->id]);
    }

    public function test_rbac_employee_is_forbidden_from_training_catalog(): void
    {
        $token = $this->issueJwt($this->employeeUser);
        $training = Training::firstOrFail();

        $this->withToken($token)->getJson('/api/v1/trainings')->assertForbidden();
        $this->withToken($token)->getJson("/api/v1/trainings/{$training->id}")->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/trainings', [
            'title' => 'Blocked Training',
            'category' => 'Teknis',
            'provider' => 'Blocked',
            'duration_hours' => 4,
            'start_date' => now()->addDays(2)->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
        ])->assertForbidden();
        $this->withToken($token)->putJson("/api/v1/trainings/{$training->id}", [
            'title' => 'Blocked Update',
        ])->assertForbidden();
        $this->withToken($token)->deleteJson("/api/v1/trainings/{$training->id}")->assertForbidden();
    }

    public function test_rbac_guest_is_unauthorized_for_training_catalog(): void
    {
        $this->getJson('/api/v1/trainings')->assertUnauthorized();
        $this->postJson('/api/v1/trainings', [])->assertUnauthorized();
    }
}
