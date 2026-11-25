<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\UserAccount;
use App\Models\WorkLog;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkLogSeeder;
use Database\Seeders\WorkplaceIssueSeeder;
use Database\Seeders\WorkSurveySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi10ManagerDashboardTest extends TestCase
{
    use RefreshDatabase;

    private UserAccount $admin;

    private UserAccount $manager;

    private UserAccount $employee1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
        $this->seed(WorkLogSeeder::class);
        $this->seed(WorkplaceIssueSeeder::class);
        $this->seed(WorkSurveySeeder::class);

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employee1 = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
    }

    public function test_guest_cannot_access_manager_dashboard(): void
    {
        $this->getJson('/api/v1/dashboard/manager')
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_cannot_access_manager_dashboard(): void
    {
        $token = $this->issueJwt($this->employee1);

        $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager')
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_can_view_complete_dashboard_summary_kpis_dimensions_and_priorities(): void
    {
        $token = $this->issueJwt($this->manager);

        $response = $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'filters' => ['department_id', 'period_month', 'period_week', 'week_start', 'week_end'],
                    'departments',
                    'kpi_summary' => [
                        'active_employees_count',
                        'avg_workload_risk_score',
                        'workload_risk_category',
                        'high_risk_employees_count',
                        'medium_risk_employees_count',
                        'low_risk_employees_count',
                        'overridden_employees_count',
                        'decent_work_score',
                        'decent_work_category',
                        'open_issues_count',
                        'in_progress_issues_count',
                        'resolved_issues_count',
                        'total_issues_count',
                        'issue_resolution_rate',
                        'active_assignments_count',
                        'urgent_assignments_count',
                        'overdue_assignments_count',
                        'weekly_logged_hours_total',
                        'active_estimated_hours_total',
                    ],
                    'decent_work_dimensions',
                    'department_comparison',
                    'employee_priorities',
                    'workplace_issues_summary' => ['counts', 'by_category', 'active_issues'],
                    'survey_wellbeing_summary',
                    'priority_highlights',
                ],
            ])
            ->assertJsonPath('data.kpi_summary.active_employees_count', 5)
            ->assertJsonPath('data.kpi_summary.total_issues_count', 4)
            ->assertJsonPath('data.kpi_summary.open_issues_count', 1)
            ->assertJsonPath('data.kpi_summary.in_progress_issues_count', 1)
            ->assertJsonPath('data.kpi_summary.resolved_issues_count', 2)
            ->assertJsonCount(6, 'data.decent_work_dimensions')
            ->assertJsonCount(3, 'data.department_comparison')
            ->assertJsonCount(5, 'data.employee_priorities');

        $this->assertEquals(50.0, $response->json('data.kpi_summary.issue_resolution_rate'));
    }

    public function test_manager_can_filter_dashboard_by_department_period_and_search(): void
    {
        $token = $this->issueJwt($this->manager);
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        // Filter by ENG department -> only 2 active employees (EMP-002 Raka & EMP-003 Alya) & 2 ENG issues
        $deptRes = $this->withToken($token)
            ->getJson("/api/v1/dashboard/manager?department_id={$engDept->id}&period_month=2026-10");

        $deptRes->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.filters.department_id', $engDept->id)
            ->assertJsonPath('data.filters.period_month', '2026-10')
            ->assertJsonPath('data.kpi_summary.active_employees_count', 2)
            ->assertJsonPath('data.kpi_summary.total_issues_count', 2)
            ->assertJsonCount(1, 'data.department_comparison')
            ->assertJsonCount(2, 'data.employee_priorities');

        // Search filter narrows employee_priorities list
        $searchRes = $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager?search=Alya');

        $searchRes->assertOk()
            ->assertJsonCount(1, 'data.employee_priorities')
            ->assertJsonPath('data.employee_priorities.0.employee_code', 'EMP-003');
    }

    public function test_dashboard_calculates_high_workload_risk_and_pp35_override_accurately(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();

        // Seed 4 additional daily logs totaling 48h + existing 9h = 57h in current week (>= 55h override trigger)
        $weekStart = now()->startOfWeek();
        foreach ([0, 1, 2, 4] as $offset) {
            WorkLog::create([
                'employee_id' => $emp4->id,
                'work_date' => $weekStart->copy()->addDays($offset)->toDateString(),
                'hours_spent' => 12.00,
                'activity_description' => 'Penanganan eskalasi operasional tambahan untuk verifikasi ambang 55 jam.',
            ]);
        }

        $res = $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager');

        $res->assertOk()
            ->assertJsonPath('data.kpi_summary.overridden_employees_count', 1)
            ->assertJsonPath('data.kpi_summary.workload_risk_category', 'high');

        $topPriority = $res->json('data.employee_priorities.0');
        $this->assertSame('EMP-004', $topPriority['employee_code']);
        $this->assertTrue($topPriority['is_overridden']);
        $this->assertSame('high', $topPriority['risk_category']);
        $this->assertSame(100, (int) $topPriority['weekly_hours_score']);
        $this->assertGreaterThanOrEqual(55, (float) $topPriority['weekly_hours_total']);
    }

    public function test_dashboard_handles_full_week_approved_leave_without_division_by_zero(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        // EMP-003 has active assignments (28h estimated) AND approved 40h leave covering the entire week
        $weekStart = now()->startOfWeek();
        LeaveRequest::create([
            'employee_id' => $emp3->id,
            'leave_type' => 'Cuti Tahunan',
            'start_date' => $weekStart->toDateString(),
            'end_date' => $weekStart->copy()->addDays(4)->toDateString(),
            'total_hours' => 40.00,
            'reason' => 'Pengujian guard pembagian dengan nol saat kapasitas kerja efektif 0 jam.',
            'status' => 'approved',
        ]);

        $res = $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager');

        $res->assertOk()
            ->assertJsonPath('status', 'success');

        $emp3Row = collect($res->json('data.employee_priorities'))
            ->firstWhere('employee_code', 'EMP-003');

        $this->assertNotNull($emp3Row);
        $this->assertEquals(0.0, $emp3Row['available_capacity_hours']);
        $this->assertEquals(100.0, $emp3Row['task_load_score']);
        $this->assertNull($emp3Row['workload_ratio']);
    }

    public function test_dashboard_enforces_nfr02_survey_privacy_and_never_exposes_individual_comments(): void
    {
        $token = $this->issueJwt($this->manager);

        // SurveyPrivacyGuard must reject manager requests attempting to filter/include individual responses
        $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager?include_individual=1')
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager?employee_id=3')
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        // Normal summary must succeed with aggregated survey metrics and zero raw employee comments
        $res = $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager?period_month=2026-10');

        $res->assertOk()
            ->assertJsonPath('data.survey_wellbeing_summary.respondents_count', 2)
            ->assertJsonPath('data.survey_wellbeing_summary.avg_wlb_score', 3.5);

        $rawJson = $res->getContent();
        $this->assertStringNotContainsString('Pembagian sprint cukup terstruktur', $rawJson);
        $this->assertStringNotContainsString('Jadwal shift operasional memerlukan penyesuaian', $rawJson);
    }

    public function test_admin_can_access_manager_dashboard(): void
    {
        $token = $this->issueJwt($this->admin);

        $this->withToken($token)
            ->getJson('/api/v1/dashboard/manager')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.kpi_summary.active_employees_count', 5);
    }
}
