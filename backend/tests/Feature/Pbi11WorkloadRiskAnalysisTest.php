<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Overtime;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\UserAccount;
use App\Models\WorkloadRisk;
use App\Models\WorkLog;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkLogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi11WorkloadRiskAnalysisTest extends TestCase
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

        $this->admin = UserAccount::where('email', 'admin@workbalance.id')->firstOrFail();
        $this->manager = UserAccount::where('email', 'manager@workbalance.id')->firstOrFail();
        $this->employee1 = UserAccount::where('email', 'pegawai1@workbalance.id')->firstOrFail();
    }

    public function test_guest_cannot_access_workload_risk_endpoints(): void
    {
        $this->getJson('/api/v1/analytics/workload-risk')
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');

        $this->postJson('/api/v1/analytics/workload-risk', [])
            ->assertUnauthorized()
            ->assertJsonPath('status', 'error');
    }

    public function test_employee_can_only_view_own_workload_risk_and_cannot_recalculate_or_view_others(): void
    {
        $token = $this->issueJwt($this->employee1);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();

        // Employee list returns strictly 1 row for EMP-003
        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/analytics/workload-risk');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(1, 'data.workload_risks')
            ->assertJsonPath('data.workload_risks.0.employee_id', $emp3->id);

        // Filtering another employee_id -> 403
        $this->withToken($token)
            ->getJson("/api/v1/analytics/workload-risk?employee_id={$emp4->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        // Recalculate endpoint forbidden for employee -> 403
        $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', [])
            ->assertForbidden()
            ->assertJsonPath('status', 'error');

        // Accessing another employee's persisted WorkloadRisk row -> 403
        $otherRisk = WorkloadRisk::create([
            'employee_id' => $emp4->id,
            'period_week' => now()->format('o-\WW'),
            'period_month' => now()->format('Y-m'),
            'weekly_hours_score' => 0,
            'overtime_score' => 20,
            'task_load_score' => 0,
            'deadline_pressure_score' => 0,
            'final_score' => 5,
            'risk_category' => 'low',
            'is_overridden' => false,
        ]);

        $this->withToken($token)
            ->getJson("/api/v1/analytics/workload-risk/{$otherRisk->id}")
            ->assertForbidden()
            ->assertJsonPath('status', 'error');
    }

    public function test_manager_can_recalculate_and_persist_workload_risks_for_all_active_employees(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', []);

        $res->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.recalculated_count', 5)
            ->assertJsonCount(5, 'data.workload_risks');

        // Verify persisted rows count in workload_risks table
        $this->assertDatabaseCount('workload_risks', 5);

        // Verify EMP-003 manual calculation:
        // weekly_hours = 18h (<= 40 -> 0), overtime = 0d (-> 0), task_load = 28/40 = 0.7 (<= 1.0 -> 0), deadline = 2/2 (100%)
        // final_score = (0 + 0 + 0 + 100) / 4 = 25.00, risk_category = low, is_overridden = false
        $emp3Risk = collect($res->json('data.workload_risks'))->firstWhere('employee_id', $emp3->id);
        $this->assertNotNull($emp3Risk);
        $this->assertEquals(0.0, $emp3Risk['weekly_hours_score']);
        $this->assertEquals(0.0, $emp3Risk['overtime_score']);
        $this->assertEquals(0.0, $emp3Risk['task_load_score']);
        $this->assertEquals(100.0, $emp3Risk['deadline_pressure_score']);
        $this->assertEquals(25.0, $emp3Risk['final_score']);
        $this->assertSame('low', $emp3Risk['risk_category']);
        $this->assertFalse($emp3Risk['is_overridden']);
    }

    public function test_linear_interpolation_accuracy_for_weekly_hours_and_task_load_scores(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $managerEmp = Employee::where('employee_code', 'EMP-002')->firstOrFail();
        $opsDept = Department::where('code', 'OPS')->firstOrFail();

        // Clear existing week work logs & assignments for EMP-004 to test pure interpolation
        WorkLog::where('employee_id', $emp4->id)->delete();
        TaskAssignment::where('employee_id', $emp4->id)->delete();

        $weekStart = now()->startOfWeek();
        // 5 days * 9.5h = 47.5h -> linear between 40h (0) and 55h (100) = 50.00!
        // Wait: to avoid overtime affecting score check independently, assert exact sub-scores directly
        for ($d = 0; $d < 5; $d++) {
            WorkLog::create([
                'employee_id' => $emp4->id,
                'work_date' => $weekStart->copy()->addDays($d)->toDateString(),
                'hours_spent' => 9.50,
                'activity_description' => 'Aktivitas pengujian interpolasi linear 47.5 jam mingguan.',
            ]);
        }

        // Assign 50h estimated hours against 40h capacity -> ratio = 1.25 -> linear between 1.0 (0) & 1.5 (100) = 50.00!
        $task = Task::create([
            'department_id' => $opsDept->id,
            'created_by' => $managerEmp->id,
            'title' => 'Pengujian Interpolasi Rasio Beban',
            'estimated_hours' => 50.00,
            'priority' => 'medium',
            'due_date' => now()->addDays(20)->toDateString(),
            'status' => 'in_progress',
        ]);
        TaskAssignment::create([
            'task_id' => $task->id,
            'employee_id' => $emp4->id,
            'assigned_by' => $managerEmp->id,
            'assigned_at' => now(),
            'deadline' => now()->addDays(20)->toDateString(), // not within 7 days -> deadline_pressure_score = 0
            'status' => 'in_progress',
        ]);

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', ['employee_id' => $emp4->id]);

        $res->assertOk();
        $row = $res->json('data.workload_risks.0');

        $this->assertEquals(47.5, $row['metrics']['weekly_hours_total']);
        $this->assertEquals(50.0, $row['weekly_hours_score']);
        $this->assertEquals(1.25, $row['metrics']['workload_ratio']);
        $this->assertEquals(50.0, $row['task_load_score']);
        $this->assertEquals(0.0, $row['deadline_pressure_score']);
        // 5 overtime days out of 5 work days -> overtime_score = 100, final = (50+100+50+0)/4 = 50.0 -> medium
        $this->assertEquals(100.0, $row['overtime_score']);
        $this->assertEquals(50.0, $row['final_score']);
        $this->assertSame('medium', $row['risk_category']);
        $this->assertFalse($row['is_overridden']);
    }

    public function test_pp35_mandatory_override_triggers_on_55_weekly_hours_daily_overtime_above_4_or_weekly_overtime_above_18(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail();
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();
        $emp5 = Employee::where('employee_code', 'EMP-005')->firstOrFail();

        $weekStart = now()->startOfWeek();

        // Reset logs & active assignments for all 3 employees so final arithmetic score stays < 70
        WorkLog::whereIn('employee_id', [$emp3->id, $emp4->id, $emp5->id])->delete();
        TaskAssignment::whereIn('employee_id', [$emp3->id, $emp4->id, $emp5->id])->delete();

        // Trigger A (EMP-003, 5-day week): 5 days * 11h = 55h (>= 55h override), daily OT = 3h (<= 4), weekly OT = 15h (<= 18)
        for ($d = 0; $d < 5; $d++) {
            WorkLog::create([
                'employee_id' => $emp3->id,
                'work_date' => $weekStart->copy()->addDays($d)->toDateString(),
                'hours_spent' => 11.00,
                'activity_description' => 'Skenario override 55 jam mingguan.',
            ]);
        }

        // Trigger B (EMP-004, 5-day week): single day 13h -> 5h daily overtime (> 4h), weekly_hours = 13h (< 55), weekly OT = 5h (<= 18)
        WorkLog::create([
            'employee_id' => $emp4->id,
            'work_date' => $weekStart->toDateString(),
            'hours_spent' => 13.00,
            'activity_description' => 'Skenario override lembur harian > 4 jam.',
        ]);

        // Trigger C (EMP-005, 6-day week): 5 days approved Overtime @ 3.8h each = 19.0h weekly overtime (> 18h), daily <= 4h, weekly_hours = 0h
        for ($d = 0; $d < 5; $d++) {
            Overtime::create([
                'employee_id' => $emp5->id,
                'overtime_date' => $weekStart->copy()->addDays($d)->toDateString(),
                'duration_hours' => 3.80,
                'reason' => 'Skenario override lembur mingguan > 18 jam.',
                'status' => 'approved',
            ]);
        }

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', []);

        $res->assertOk();
        $rows = collect($res->json('data.workload_risks'));

        foreach ([$emp3->id, $emp4->id, $emp5->id] as $id) {
            $row = $rows->firstWhere('employee_id', $id);
            $this->assertNotNull($row);
            $this->assertLessThan(70.0, $row['final_score']);
            $this->assertTrue($row['is_overridden'], "Employee ID {$id} expected is_overridden=true");
            $this->assertSame('high', $row['risk_category'], "Employee ID {$id} expected high via PP 35/2021 override");
            $this->assertNotEmpty($row['override_reasons']);
        }
    }

    public function test_overtime_calculation_respects_6_day_workweek_and_prioritizes_approved_overtime_records(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail(); // 5-day week (8h/day normal)
        $emp5 = Employee::where('employee_code', 'EMP-005')->firstOrFail(); // 6-day week (7h/day normal)

        WorkLog::whereIn('employee_id', [$emp4->id, $emp5->id])->delete();
        $weekStart = now()->startOfWeek();

        // EMP-005 (6-day week): logs 7.5h/day (> 7.0h daily normal, would be <= 8.0 on 5-day!) -> detects 0.5h OT on 1/6 workdays = 16.67
        WorkLog::create([
            'employee_id' => $emp5->id,
            'work_date' => $weekStart->toDateString(),
            'hours_spent' => 7.50,
            'activity_description' => 'Lembur otomatis pegawai 6 hari kerja di atas batas 7 jam.',
        ]);

        // EMP-004 (5-day week): logs 12h/day (would imply 4h work_log overtime) BUT has 1 approved Overtime record of 2.0h
        // Trap 3 rule: MUST prioritize approved `overtimes` (2.0h) instead of deriving 4.0h from work_logs!
        WorkLog::create([
            'employee_id' => $emp4->id,
            'work_date' => $weekStart->toDateString(),
            'hours_spent' => 12.00,
            'activity_description' => 'Kerja harian dengan dokumen lembur disetujui resmi.',
        ]);
        Overtime::create([
            'employee_id' => $emp4->id,
            'overtime_date' => $weekStart->toDateString(),
            'duration_hours' => 2.00,
            'reason' => 'Dukungan rilis malam terjadwal.',
            'status' => 'approved',
        ]);

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', []);

        $res->assertOk();
        $rows = collect($res->json('data.workload_risks'));

        $emp5Row = $rows->firstWhere('employee_id', $emp5->id);
        $this->assertEquals(7.0, $emp5Row['metrics']['normal_daily_hours']);
        $this->assertEquals(0.5, $emp5Row['metrics']['overtime_hours_total']);
        $this->assertSame('work_logs', $emp5Row['metrics']['overtime_source']);
        $this->assertEquals(16.67, $emp5Row['overtime_score']);

        $emp4Row = $rows->firstWhere('employee_id', $emp4->id);
        $this->assertSame('approved_overtimes', $emp4Row['metrics']['overtime_source']);
        $this->assertEquals(2.0, $emp4Row['metrics']['overtime_hours_total']);
        $this->assertEquals(20.0, $emp4Row['overtime_score']);
    }

    public function test_full_week_approved_leave_handles_zero_available_capacity_without_division_by_zero(): void
    {
        $token = $this->issueJwt($this->manager);
        $emp3 = Employee::where('employee_code', 'EMP-003')->firstOrFail(); // Has active assignments (28h)
        $emp5 = Employee::where('employee_code', 'EMP-005')->firstOrFail(); // Only completed assignment -> 0 active tasks

        $weekStart = now()->startOfWeek();

        // Both employees take full-week 40h approved leave -> available_capacity_hours = 0
        foreach ([$emp3, $emp5] as $emp) {
            LeaveRequest::create([
                'employee_id' => $emp->id,
                'leave_type' => 'Cuti Tahunan',
                'start_date' => $weekStart->toDateString(),
                'end_date' => $weekStart->copy()->addDays(4)->toDateString(),
                'total_hours' => 40.00,
                'reason' => 'Pengujian pembagian dengan nol kapasitas cuti penuh.',
                'status' => 'approved',
            ]);
        }

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', []);

        $res->assertOk();
        $rows = collect($res->json('data.workload_risks'));

        // EMP-003 has active tasks -> task_load_score MUST be 100.0
        $emp3Row = $rows->firstWhere('employee_id', $emp3->id);
        $this->assertEquals(0.0, $emp3Row['metrics']['available_capacity_hours']);
        $this->assertEquals(100.0, $emp3Row['task_load_score']);
        $this->assertNull($emp3Row['metrics']['workload_ratio']);

        // EMP-005 has 0 active tasks -> task_load_score MUST be 0.0
        $emp5Row = $rows->firstWhere('employee_id', $emp5->id);
        $this->assertEquals(0.0, $emp5Row['metrics']['available_capacity_hours']);
        $this->assertEquals(0.0, $emp5Row['task_load_score']);
    }

    public function test_manager_can_filter_workload_risks_by_department_category_override_and_search(): void
    {
        $token = $this->issueJwt($this->manager);
        $engDept = Department::where('code', 'ENG')->firstOrFail();
        $emp4 = Employee::where('employee_code', 'EMP-004')->firstOrFail();

        // Trigger override on EMP-004 in OPS
        WorkLog::where('employee_id', $emp4->id)->delete();
        WorkLog::create([
            'employee_id' => $emp4->id,
            'work_date' => now()->startOfWeek()->toDateString(),
            'hours_spent' => 13.00,
            'activity_description' => 'Filter test override PP 35/2021.',
        ]);

        // Calculate all
        $this->withToken($token)->postJson('/api/v1/analytics/workload-risk', [])->assertOk();

        // Filter by department_id = ENG (2 active employees)
        $this->withToken($token)
            ->getJson("/api/v1/analytics/workload-risk?department_id={$engDept->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.workload_risks');

        // Filter by risk_category = high & is_overridden = 1 -> only EMP-004
        $filtered = $this->withToken($token)
            ->getJson('/api/v1/analytics/workload-risk?risk_category=high&is_overridden=1&search=Bima');

        $filtered->assertOk()
            ->assertJsonCount(1, 'data.workload_risks')
            ->assertJsonPath('data.workload_risks.0.employee.employee_code', 'EMP-004');

        // Show single WorkloadRisk detail
        $riskId = $filtered->json('data.workload_risks.0.id');
        $this->withToken($token)
            ->getJson("/api/v1/analytics/workload-risk/{$riskId}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $riskId)
            ->assertJsonStructure(['data' => ['active_assignments', 'week_work_logs', 'metrics', 'override_reasons']]);
    }

    public function test_admin_can_trigger_targeted_recalculation_and_view_details(): void
    {
        $token = $this->issueJwt($this->admin);
        $engDept = Department::where('code', 'ENG')->firstOrFail();

        $res = $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', [
                'department_id' => $engDept->id,
            ]);

        $res->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.recalculated_count', 2)
            ->assertJsonCount(2, 'data.workload_risks');
    }

    public function test_validation_rejects_invalid_period_week_or_nonexistent_department_on_recalculate(): void
    {
        $token = $this->issueJwt($this->manager);

        $this->withToken($token)
            ->postJson('/api/v1/analytics/workload-risk', [
                'period_week' => '2026-99',
                'department_id' => 999999,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['data' => ['errors' => ['period_week', 'department_id']]]);
    }
}
