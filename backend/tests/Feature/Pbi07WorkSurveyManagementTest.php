<?php

namespace Tests\Feature;

use App\Models\UserAccount;
use App\Models\WorkSurvey;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkSurveySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi07WorkSurveyManagementTest extends TestCase
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
        $this->seed(WorkSurveySeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employee1 = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
        $this->employee2 = UserAccount::where('email', 'pegawai2@workbalance.id')->firstOrFail();
    }

    public function test_employee_can_list_surveys_submit_and_update_own_response(): void
    {
        $token = $this->issueJwt($this->employee1);
        $novSurvey = WorkSurvey::where('period_month', '2026-11')->firstOrFail();

        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/surveys');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.surveys')
            ->assertJsonPath('data.summary.my_submitted_count', 1)
            ->assertJsonPath('data.summary.my_pending_count', 1);

        $novPayload = collect($listResponse->json('data.surveys'))->firstWhere('id', $novSurvey->id);
        $this->assertNull($novPayload['my_response']);

        // Submit Likert 1-5 response to active survey
        $this->withToken($token)
            ->postJson("/api/v1/surveys/{$novSurvey->id}/responses", [
                'work_life_balance_score' => 5,
                'workload_perception_score' => 2,
                'comments' => 'Beban kerja sangat terjaga bulan ini.',
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.work_life_balance_score', 5)
            ->assertJsonPath('data.workload_perception_score', 2);

        // Update own response while survey is active
        $this->withToken($token)
            ->putJson("/api/v1/surveys/{$novSurvey->id}/responses", [
                'work_life_balance_score' => 4,
                'workload_perception_score' => 3,
                'comments' => 'Penyesuaian komentar terbaru.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.work_life_balance_score', 4)
            ->assertJsonPath('data.workload_perception_score', 3)
            ->assertJsonPath('data.comments', 'Penyesuaian komentar terbaru.');

        // Verify summary updates and own response is attached without leaking other responses
        $afterResponse = $this->withToken($token)
            ->getJson('/api/v1/surveys');

        $afterResponse->assertOk()
            ->assertJsonPath('data.summary.my_submitted_count', 2)
            ->assertJsonPath('data.summary.my_pending_count', 0);

        $novAfter = collect($afterResponse->json('data.surveys'))->firstWhere('id', $novSurvey->id);
        $this->assertSame(4, $novAfter['my_response']['work_life_balance_score']);
        $this->assertSame(2, $novAfter['responses_count']);
    }

    public function test_employee_cannot_submit_duplicate_response_or_submit_to_inactive_survey(): void
    {
        $token = $this->issueJwt($this->employee2);
        $octSurvey = WorkSurvey::where('period_month', '2026-10')->firstOrFail();
        $novSurvey = WorkSurvey::where('period_month', '2026-11')->firstOrFail();

        // Duplicate response on 2026-11 (EMP-004 already seeded there) -> 409
        $this->withToken($token)
            ->postJson("/api/v1/surveys/{$novSurvey->id}/responses", [
                'work_life_balance_score' => 4,
                'workload_perception_score' => 3,
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Updating response on closed survey (2026-10) -> 409
        $this->withToken($token)
            ->putJson("/api/v1/surveys/{$octSurvey->id}/responses", [
                'work_life_balance_score' => 5,
                'workload_perception_score' => 2,
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Submitting to inactive survey -> 409
        $closedSurvey = WorkSurvey::create([
            'title' => 'Survei Tutup',
            'period_month' => '2026-09',
            'is_active' => false,
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/surveys/{$closedSurvey->id}/responses", [
                'work_life_balance_score' => 4,
                'workload_perception_score' => 3,
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_receives_strictly_aggregated_metrics_and_privacy_guard_blocks_individual_queries(): void
    {
        $token = $this->issueJwt($this->manager);
        $octSurvey = WorkSurvey::where('period_month', '2026-10')->firstOrFail();
        $novSurvey = WorkSurvey::where('period_month', '2026-11')->firstOrFail();

        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/surveys');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.surveys');

        // Verify NFR-02: NO individual identifiers, NO comments, NO my_response, NO raw responses array
        $rawJson = $listResponse->getContent();
        $this->assertStringNotContainsString('employee_id', $rawJson);
        $this->assertStringNotContainsString('comments', $rawJson);
        $this->assertStringNotContainsString('my_response', $rawJson);
        $this->assertStringNotContainsString('Alya Permata', $rawJson);
        $this->assertStringNotContainsString('Bima Wijaya', $rawJson);
        $this->assertStringNotContainsString('Jadwal shift operasional', $rawJson);

        // Verify PRD 4.2 Dimensi 2 formula: Oct avg WLB = (4+3)/2 = 3.5 -> (3.5-1)/4*100 = 62.5
        $octData = collect($listResponse->json('data.surveys'))->firstWhere('id', $octSurvey->id);
        $this->assertSame(2, $octData['responses_count']);
        $this->assertEquals(3.5, $octData['avg_wlb_score']);
        $this->assertEquals(62.5, $octData['converted_wlb_dimension_score']);
        $this->assertEquals(40.0, $octData['participation_rate']);

        // Show single survey also maintains NFR-02 privacy
        $detailResponse = $this->withToken($token)
            ->getJson("/api/v1/surveys/{$novSurvey->id}");

        $detailResponse->assertOk()
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['id', 'title', 'department_aggregates'],
            ]);
        $this->assertStringNotContainsString('employee_id', $detailResponse->getContent());
        $this->assertStringNotContainsString('comments', $detailResponse->getContent());

        // SurveyPrivacyGuard must block manager queries requesting individual data -> 403
        $this->withToken($token)
            ->getJson('/api/v1/surveys?employee_id=3')
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->getJson("/api/v1/surveys/{$novSurvey->id}?include_individual=1")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_can_create_update_and_delete_empty_survey(): void
    {
        $token = $this->issueJwt($this->manager);

        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/surveys', [
                'title' => 'Survei Evaluasi Desember 2026',
                'period_month' => '2026-12',
                'description' => 'Evaluasi kondisi kerja akhir tahun.',
                'is_active' => true,
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.period_month', '2026-12')
            ->assertJsonPath('data.is_active', true);

        $surveyId = $createResponse->json('data.id');

        $this->withToken($token)
            ->putJson("/api/v1/surveys/{$surveyId}", [
                'title' => 'Survei Akhir Tahun Desember 2026',
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Survei Akhir Tahun Desember 2026')
            ->assertJsonPath('data.is_active', false);

        $this->withToken($token)
            ->deleteJson("/api/v1/surveys/{$surveyId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('work_surveys', ['id' => $surveyId]);
    }

    public function test_admin_cannot_delete_survey_with_existing_responses(): void
    {
        $token = $this->issueJwt($this->admin);
        $octSurvey = WorkSurvey::where('period_month', '2026-10')->firstOrFail();

        $this->withToken($token)
            ->deleteJson("/api/v1/surveys/{$octSurvey->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('work_surveys', ['id' => $octSurvey->id]);
    }

    public function test_survey_validation_rejects_out_of_range_likert_scores_and_invalid_period(): void
    {
        $adminToken = $this->issueJwt($this->admin);

        $this->withToken($adminToken)
            ->postJson('/api/v1/surveys', [
                'title' => '',
                'period_month' => '2026-13',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['title', 'period_month']],
            ]);
    }

    public function test_employee_response_validation_rejects_out_of_range_likert_scores(): void
    {
        $empToken = $this->issueJwt($this->employee1);
        $novSurvey = WorkSurvey::where('period_month', '2026-11')->firstOrFail();

        $this->withToken($empToken)
            ->postJson("/api/v1/surveys/{$novSurvey->id}/responses", [
                'work_life_balance_score' => 0,
                'workload_perception_score' => 6,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['errors' => ['work_life_balance_score', 'workload_perception_score']],
            ]);
    }

    public function test_rbac_employee_cannot_manage_survey_questionnaires_and_guest_is_unauthorized(): void
    {
        $novSurvey = WorkSurvey::where('period_month', '2026-11')->firstOrFail();

        $this->getJson('/api/v1/surveys')->assertUnauthorized();
        $this->postJson('/api/v1/surveys', [])->assertUnauthorized();

        $empToken = $this->issueJwt($this->employee1);

        $this->withToken($empToken)->postJson('/api/v1/surveys', [
            'title' => 'Blocked Employee Survey',
            'period_month' => '2026-12',
        ])->assertForbidden();

        $this->withToken($empToken)->putJson("/api/v1/surveys/{$novSurvey->id}", [
            'is_active' => false,
        ])->assertForbidden();

        $this->withToken($empToken)->deleteJson("/api/v1/surveys/{$novSurvey->id}")->assertForbidden();
    }
}
