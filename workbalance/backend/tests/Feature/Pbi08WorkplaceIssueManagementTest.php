<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\UserAccount;
use App\Models\WorkplaceIssue;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkplaceIssueSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi08WorkplaceIssueManagementTest extends TestCase
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
        $this->seed(WorkplaceIssueSeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employee1 = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
        $this->employee2 = UserAccount::where('email', 'pegawai2@workbalance.id')->firstOrFail();
    }

    public function test_guest_cannot_access_workplace_issues_endpoints(): void
    {
        $this->getJson('/api/v1/workplace-issues')
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');

        $this->postJson('/api/v1/workplace-issues', [
            'category' => 'Beban Kerja',
            'description' => 'Laporan tanpa autentikasi yang harus ditolak sistem.',
        ])
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_lists_only_own_issues_and_can_create_edit_and_delete_open_issue(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/workplace-issues');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.issues')
            ->assertJsonPath('data.summary.total', 2)
            ->assertJsonPath('data.summary.open', 1)
            ->assertJsonPath('data.summary.in_progress', 0)
            ->assertJsonPath('data.summary.resolved', 1)
            ->assertJsonPath('data.summary.resolution_rate', 50);

        $this->assertNotEmpty($listResponse->json('data.departments'));

        // Submit new issue without department_id -> defaults to reporter's own department & forces status=open
        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/workplace-issues', [
                'category' => 'Kenyamanan & K3',
                'description' => 'Kabel jaringan di area kerja lorong barat perlu dirapikan agar aman dilewati.',
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.reported_by', $emp3->id)
            ->assertJsonPath('data.department_id', $emp3->department_id)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.resolution_notes', null)
            ->assertJsonPath('data.resolved_at', null);

        $createdId = $createResponse->json('data.id');

        // View single own issue
        $this->withToken($token)
            ->getJson("/api/v1/workplace-issues/{$createdId}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $createdId);

        // Edit own open issue
        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$createdId}", [
                'category' => 'Fasilitas & Ergonomi',
                'description' => 'Kabel jaringan serta stopkontak lantai dua perlu pengaman tambahan demi K3.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.category', 'Fasilitas & Ergonomi')
            ->assertJsonPath('data.status', 'open');

        // Delete own open issue
        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$createdId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('workplace_issues', ['id' => $createdId]);
    }

    public function test_employee_cannot_view_edit_or_delete_other_employees_issue(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $otherIssue = WorkplaceIssue::where('reported_by', $emp4->id)->firstOrFail();

        $this->withToken($token)
            ->getJson("/api/v1/workplace-issues/{$otherIssue->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$otherIssue->id}", [
                'category' => 'Beban Kerja',
                'description' => 'Percobaan mengubah laporan pegawai lain harus ditolak.',
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$otherIssue->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_cannot_modify_status_or_resolution_notes_on_own_issue(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $openIssue = WorkplaceIssue::where('reported_by', $emp3->id)
            ->where('status', 'open')
            ->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$openIssue->id}", [
                'status' => 'resolved',
                'resolution_notes' => 'Mencoba menyelesaikan sendiri.',
            ])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_cannot_edit_or_delete_resolved_issue(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $resolvedIssue = WorkplaceIssue::where('reported_by', $emp3->id)
            ->where('status', 'resolved')
            ->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$resolvedIssue->id}", [
                'description' => 'Mengubah deskripsi isu yang sudah selesai harus ditolak.',
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$resolvedIssue->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_cannot_edit_or_delete_in_progress_issue(): void
    {
        $token = $this->employee2->createToken('emp2')->plainTextToken;
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $inProgressIssue = WorkplaceIssue::where('reported_by', $emp4->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$inProgressIssue->id}", [
                'description' => 'Mengubah deskripsi isu yang sedang diproses harus ditolak.',
            ])
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$inProgressIssue->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_can_list_filter_and_follow_up_issues_with_resolved_at_lifecycle(): void
    {
        $token = $this->manager->createToken('mgr')->plainTextToken;
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/workplace-issues');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(4, 'data.issues')
            ->assertJsonPath('data.summary.total', 4)
            ->assertJsonPath('data.summary.open', 1)
            ->assertJsonPath('data.summary.in_progress', 1)
            ->assertJsonPath('data.summary.resolved', 2)
            ->assertJsonPath('data.summary.resolution_rate', 50);

        // Filters work accurately
        $this->withToken($token)
            ->getJson("/api/v1/workplace-issues?status=open&department_id={$engDept->id}&category=Beban+Kerja&search=audit")
            ->assertOk()
            ->assertJsonCount(1, 'data.issues');

        $openIssue = WorkplaceIssue::where('status', 'open')->firstOrFail();

        // Transition open -> in_progress (resolved_at remains null)
        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$openIssue->id}", [
                'status' => 'in_progress',
                'resolution_notes' => 'Sedang dilakukan penjadwalan ulang sprint backlog bersama tech lead.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.resolved_at', null);

        // Transition in_progress -> resolved (resolved_at populated automatically)
        $resolvedRes = $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$openIssue->id}", [
                'status' => 'resolved',
                'resolution_notes' => 'Prioritas tugas audit telah didistribusikan ulang agar beban kerja kembali normal.',
            ]);

        $resolvedRes->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'resolved');

        $this->assertNotNull($resolvedRes->json('data.resolved_at'));

        // Verify resolution_rate summary rose to 75% (3 of 4 resolved)
        $this->withToken($token)
            ->getJson('/api/v1/workplace-issues')
            ->assertOk()
            ->assertJsonPath('data.summary.resolved', 3)
            ->assertJsonPath('data.summary.resolution_rate', 75);

        // Reopen back to in_progress -> resolved_at clears to null
        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$openIssue->id}", [
                'status' => 'in_progress',
                'resolution_notes' => 'Dibuka kembali untuk evaluasi sprint lanjutan.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.resolved_at', null);
    }

    public function test_admin_can_delete_open_issue_but_cannot_delete_non_open_issues_for_audit_protection(): void
    {
        $token = $this->admin->createToken('admin')->plainTextToken;

        $openIssue = WorkplaceIssue::where('status', 'open')->firstOrFail();
        $inProgressIssue = WorkplaceIssue::where('status', 'in_progress')->firstOrFail();
        $resolvedIssue = WorkplaceIssue::where('status', 'resolved')->firstOrFail();

        // Deleting in_progress or resolved rejected with 409 for audit protection
        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$inProgressIssue->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$resolvedIssue->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Deleting open issue succeeds
        $this->withToken($token)
            ->deleteJson("/api/v1/workplace-issues/{$openIssue->id}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('workplace_issues', ['id' => $openIssue->id]);
    }

    public function test_validation_rejects_invalid_store_workplace_issue_payloads(): void
    {
        $token = $this->employee1->createToken('emp1')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/workplace-issues', [
                'category' => '',
                'description' => 'Terlalu',
                'department_id' => 999999,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['data' => ['errors' => ['category', 'description', 'department_id']]]);
    }

    public function test_validation_rejects_invalid_update_status_payload(): void
    {
        $token = $this->admin->createToken('admin')->plainTextToken;
        $openIssue = WorkplaceIssue::where('status', 'open')->firstOrFail();

        $this->withToken($token)
            ->putJson("/api/v1/workplace-issues/{$openIssue->id}", [
                'status' => 'dismissed',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['data' => ['errors' => ['status']]]);
    }
}
