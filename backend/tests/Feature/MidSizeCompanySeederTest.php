<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Position;
use App\Models\SurveyResponse;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\Training;
use App\Models\TrainingParticipation;
use App\Models\WorkLog;
use App\Models\WorkloadRisk;
use App\Models\WorkplaceIssue;
use App\Models\WorkSurvey;
use Database\Seeders\MidSizeCompanySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MidSizeCompanySeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_mid_size_company_seeder_populates_realistic_enterprise_dataset_idempotently(): void
    {
        $this->seed(MidSizeCompanySeeder::class);

        $departmentsCount = Department::count();
        $employeesCount = Employee::count();
        $activeEmployeesCount = Employee::where('status', 'active')->count();
        $positionsCount = Position::count();
        $employmentTypesCount = EmploymentType::count();
        $tasksCount = Task::count();
        $assignmentsCount = TaskAssignment::count();
        $workLogsCount = WorkLog::count();
        $trainingsCount = Training::count();
        $participationsCount = TrainingParticipation::count();
        $surveysCount = WorkSurvey::count();
        $responsesCount = SurveyResponse::count();
        $issuesCount = WorkplaceIssue::count();

        $this->assertSame(10, $departmentsCount);
        $this->assertSame(70, $employeesCount);
        $this->assertGreaterThanOrEqual(65, $activeEmployeesCount);
        $this->assertGreaterThanOrEqual(24, $positionsCount);
        $this->assertSame(4, $employmentTypesCount);
        $this->assertGreaterThanOrEqual(40, $tasksCount);
        $this->assertGreaterThanOrEqual(70, $assignmentsCount);
        $this->assertGreaterThanOrEqual(250, $workLogsCount);
        $this->assertGreaterThanOrEqual(10, $trainingsCount);
        $this->assertGreaterThanOrEqual(80, $participationsCount);
        $this->assertGreaterThanOrEqual(4, $surveysCount);
        $this->assertGreaterThanOrEqual(140, $responsesCount);
        $this->assertGreaterThanOrEqual(16, $issuesCount);

        // Verify all 3 risk bands + PP No. 35/2021 override scenarios are present
        $this->assertGreaterThanOrEqual(5, WorkloadRisk::where('is_overridden', true)->count());
        $this->assertGreaterThan(0, WorkloadRisk::where('risk_category', 'high')->count());
        $this->assertGreaterThan(0, WorkloadRisk::where('risk_category', 'medium')->count());
        $this->assertGreaterThan(0, WorkloadRisk::where('risk_category', 'low')->count());

        // Verify demo quick-login accounts still exist and remain active
        $this->assertDatabaseHas('user_accounts', ['email' => 'admin@workbalance.id', 'role' => 'admin', 'is_active' => true]);
        $this->assertDatabaseHas('user_accounts', ['email' => 'manager@workbalance.id', 'role' => 'manager', 'is_active' => true]);
        $this->assertDatabaseHas('user_accounts', ['email' => 'pegawai1@workbalance.id', 'role' => 'employee', 'is_active' => true]);

        // Re-running seeder must be strictly idempotent (zero duplicate rows)
        $this->seed(MidSizeCompanySeeder::class);

        $this->assertSame($departmentsCount, Department::count());
        $this->assertSame($employeesCount, Employee::count());
        $this->assertSame($tasksCount, Task::count());
        $this->assertSame($assignmentsCount, TaskAssignment::count());
        $this->assertSame($workLogsCount, WorkLog::count());
        $this->assertSame($responsesCount, SurveyResponse::count());
        $this->assertSame($issuesCount, WorkplaceIssue::count());
    }
}
