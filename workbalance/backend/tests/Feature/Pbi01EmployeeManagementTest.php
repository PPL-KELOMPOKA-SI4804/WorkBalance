<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Position;
use App\Models\UserAccount;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Pbi01EmployeeManagementTest extends TestCase
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

    public function test_auth_login_me_and_logout_flow(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@workbalance.id',
            'password' => 'password123',
        ]);

        $loginResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.user.role', 'admin')
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['token', 'token_type', 'user' => ['id', 'email', 'role', 'employee']],
            ]);

        $token = $loginResponse->json('data.token');

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.email', 'admin@workbalance.id');

        $this->withToken($token)
            ->deleteJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('status', 'success');

        // Verify token was deleted from personal_access_tokens
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_public_register_and_inactive_login_rejection(): void
    {
        $registerResponse = $this->postJson('/api/v1/auth/register', [
            'email' => 'baru@workbalance.id',
            'password' => 'secret123',
            'role' => 'admin', // Public registration must ignore privilege escalation
        ]);

        $registerResponse->assertCreated()
            ->assertJsonPath('data.user.role', 'employee');

        UserAccount::where('email', 'baru@workbalance.id')->update(['is_active' => false]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'baru@workbalance.id',
            'password' => 'secret123',
        ])->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@workbalance.id',
            'password' => 'wrong-password',
        ])->assertUnauthorized();
    }

    public function test_admin_can_perform_full_crud_on_employees_and_sync_account_status(): void
    {
        $department = Department::where('code', 'ENG')->firstOrFail();
        $position = Position::where('title', 'Senior Software Engineer')->firstOrFail();
        $employmentType = EmploymentType::where('name', 'Tetap (PKWTT)')->firstOrFail();

        $token = $this->admin->createToken('test')->plainTextToken;

        // List with summary
        $this->withToken($token)
            ->getJson('/api/v1/employees')
            ->assertOk()
            ->assertJsonPath('data.summary.total', 5)
            ->assertJsonPath('data.summary.active', 5)
            ->assertJsonPath('data.summary.inactive', 0)
            ->assertJsonPath('data.summary.employment_types_count', 3);

        // Create employee + linked user account
        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'EMP-099',
                'full_name' => 'Dina Maharani',
                'department_id' => $department->id,
                'position_id' => $position->id,
                'employment_type_id' => $employmentType->id,
                'join_date' => '2026-11-01',
                'status' => 'active',
                'email' => 'dina@workbalance.id',
                'password' => 'password123',
                'role' => 'employee',
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.employee_code', 'EMP-099')
            ->assertJsonPath('data.user_account.email', 'dina@workbalance.id')
            ->assertJsonPath('data.user_account.is_active', true);

        $createdEmployeeId = $createResponse->json('data.id');
        $createdAccountId = $createResponse->json('data.user_account.id');

        // Duplicate employee_code or email must fail validation (422)
        $this->withToken($token)
            ->postJson('/api/v1/employees', [
                'employee_code' => 'EMP-099',
                'full_name' => 'Duplikat',
                'department_id' => $department->id,
                'position_id' => $position->id,
                'employment_type_id' => $employmentType->id,
                'join_date' => '2026-11-01',
                'email' => 'dina@workbalance.id',
            ])->assertUnprocessable()
            ->assertJsonPath('status', 'error');

        // Search filter
        $this->withToken($token)
            ->getJson('/api/v1/employees?search=Maharani')
            ->assertOk()
            ->assertJsonCount(1, 'data.employees')
            ->assertJsonPath('data.employees.0.employee_code', 'EMP-099');

        // Update employee status to inactive -> must sync user_accounts.is_active = false
        $this->withToken($token)
            ->putJson("/api/v1/employees/{$createdEmployeeId}", [
                'full_name' => 'Dina Maharani Putri',
                'status' => 'inactive',
            ])->assertOk()
            ->assertJsonPath('data.full_name', 'Dina Maharani Putri')
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.user_account.is_active', false);

        $this->assertDatabaseHas('user_accounts', [
            'id' => $createdAccountId,
            'is_active' => 0,
        ]);

        // Delete employee and linked account
        $this->withToken($token)
            ->deleteJson("/api/v1/employees/{$createdEmployeeId}")
            ->assertOk();

        $this->assertDatabaseMissing('employees', ['id' => $createdEmployeeId]);
        $this->assertDatabaseMissing('user_accounts', ['id' => $createdAccountId]);
    }

    public function test_admin_cannot_delete_employee_managing_a_department(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();

        $this->withToken($token)
            ->deleteJson("/api/v1/employees/{$managerEmployee->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');
    }

    public function test_admin_crud_employment_types_and_restrict_delete_guard(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        // List seeded employment types
        $this->withToken($token)
            ->getJson('/api/v1/employment-types')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        // Create unused employment type
        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/employment-types', [
                'name' => 'Paruh Waktu (Part-Time)',
                'work_days_per_week' => 5,
                'normal_weekly_hours' => 25,
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('data.name', 'Paruh Waktu (Part-Time)')
            ->assertJsonPath('data.normal_weekly_hours', 25);

        $newTypeId = $createResponse->json('data.id');

        // Invalid work_days_per_week must return 422
        $this->withToken($token)
            ->postJson('/api/v1/employment-types', [
                'name' => 'Invalid Days',
                'work_days_per_week' => 7,
                'normal_weekly_hours' => 40,
            ])->assertUnprocessable();

        // Update newly created type
        $this->withToken($token)
            ->putJson("/api/v1/employment-types/{$newTypeId}", [
                'name' => 'Paruh Waktu Fleksibel',
                'work_days_per_week' => 6,
                'normal_weekly_hours' => 30,
            ])->assertOk()
            ->assertJsonPath('data.work_days_per_week', 6);

        // Delete referenced employment type must fail with 409 Conflict (restrictOnDelete)
        $usedType = EmploymentType::where('name', 'Tetap (PKWTT)')->firstOrFail();
        $this->withToken($token)
            ->deleteJson("/api/v1/employment-types/{$usedType->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        // Delete unused employment type succeeds
        $this->withToken($token)
            ->deleteJson("/api/v1/employment-types/{$newTypeId}")
            ->assertOk();

        $this->assertDatabaseMissing('employment_types', ['id' => $newTypeId]);
    }

    public function test_rbac_guest_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/employees')->assertUnauthorized();
        $this->postJson('/api/v1/employees', [])->assertUnauthorized();
    }

    public function test_rbac_manager_has_read_only_access(): void
    {
        $department = Department::firstOrFail();
        $position = Position::firstOrFail();
        $employmentType = EmploymentType::firstOrFail();

        $managerToken = $this->manager->createToken('mgr')->plainTextToken;

        $this->withToken($managerToken)->getJson('/api/v1/employees')->assertOk();
        $this->withToken($managerToken)->getJson('/api/v1/employment-types')->assertOk();
        $this->withToken($managerToken)->getJson('/api/v1/departments')->assertOk();
        $this->withToken($managerToken)->getJson('/api/v1/positions')->assertOk();

        $this->withToken($managerToken)->postJson('/api/v1/employees', [
            'employee_code' => 'EMP-900',
            'full_name' => 'Blocked Manager Create',
            'department_id' => $department->id,
            'position_id' => $position->id,
            'employment_type_id' => $employmentType->id,
            'join_date' => '2026-11-19',
        ])->assertForbidden();

        $this->withToken($managerToken)->putJson('/api/v1/employees/1', [
            'full_name' => 'Blocked Update',
        ])->assertForbidden();

        $this->withToken($managerToken)->deleteJson('/api/v1/employees/3')->assertForbidden();

        $this->withToken($managerToken)->postJson('/api/v1/employment-types', [
            'name' => 'Blocked Type',
            'work_days_per_week' => 5,
            'normal_weekly_hours' => 40,
        ])->assertForbidden();
    }

    public function test_rbac_employee_is_forbidden_from_master_management(): void
    {
        $employeeToken = $this->employeeUser->createToken('emp')->plainTextToken;

        $this->withToken($employeeToken)->getJson('/api/v1/employees')->assertForbidden();
        $this->withToken($employeeToken)->getJson('/api/v1/employment-types')->assertForbidden();
        $this->withToken($employeeToken)->postJson('/api/v1/employees', [])->assertForbidden();
        $this->withToken($employeeToken)->deleteJson('/api/v1/employees/1')->assertForbidden();
    }
}
