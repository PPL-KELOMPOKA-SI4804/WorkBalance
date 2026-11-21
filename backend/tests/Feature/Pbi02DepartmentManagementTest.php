<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Task;
use App\Models\UserAccount;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Pbi02DepartmentManagementTest extends TestCase
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

    public function test_admin_can_list_and_filter_departments_with_employee_counts_and_manager(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        // List all seeded departments (ENG, OPS, HRD)
        $listResponse = $this->withToken($token)
            ->getJson('/api/v1/departments');

        $listResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(3, 'data');

        $eng = collect($listResponse->json('data'))->firstWhere('code', 'ENG');
        $this->assertNotNull($eng);
        $this->assertSame(2, $eng['employees_count']);
        $this->assertSame(2, $eng['active_employees_count']);
        $this->assertSame('Raka Pratama', $eng['manager']['full_name']);

        // Search filter by department code/name or manager name
        $this->withToken($token)
            ->getJson('/api/v1/departments?search=Raka')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'ENG');

        // Filter has_manager=with_manager
        $this->withToken($token)
            ->getJson('/api/v1/departments?has_manager=with_manager')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'ENG');

        // Filter has_manager=without_manager
        $this->withToken($token)
            ->getJson('/api/v1/departments?has_manager=without_manager')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_admin_can_create_view_update_and_delete_department(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;
        $managerEmployee = Employee::where('employee_code', 'EMP-002')->firstOrFail();

        // Create department
        $createResponse = $this->withToken($token)
            ->postJson('/api/v1/departments', [
                'code' => 'FIN',
                'name' => 'Keuangan & Kepatuhan',
                'description' => 'Pengelolaan anggaran operasional dan pelaporan keuangan.',
                'manager_id' => $managerEmployee->id,
            ]);

        $createResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.code', 'FIN')
            ->assertJsonPath('data.name', 'Keuangan & Kepatuhan')
            ->assertJsonPath('data.manager.id', $managerEmployee->id)
            ->assertJsonPath('data.employees_count', 0);

        $departmentId = $createResponse->json('data.id');

        // View single department detail
        $this->withToken($token)
            ->getJson("/api/v1/departments/{$departmentId}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.code', 'FIN')
            ->assertJsonPath('data.manager.full_name', 'Raka Pratama');

        // Update department (clear manager and update name/code)
        $this->withToken($token)
            ->putJson("/api/v1/departments/{$departmentId}", [
                'code' => 'FIN-OPS',
                'name' => 'Keuangan & Operasional',
                'description' => 'Diperbarui untuk audit internal.',
                'manager_id' => null,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.code', 'FIN-OPS')
            ->assertJsonPath('data.name', 'Keuangan & Operasional')
            ->assertJsonPath('data.manager_id', null);

        // Delete empty department
        $this->withToken($token)
            ->deleteJson("/api/v1/departments/{$departmentId}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseMissing('departments', ['id' => $departmentId]);
    }

    public function test_department_validation_rejects_duplicate_code_and_invalid_manager(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        // Duplicate code (ENG already exists)
        $this->withToken($token)
            ->postJson('/api/v1/departments', [
                'code' => 'ENG',
                'name' => 'Duplikat Engineering',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['status', 'message', 'data' => ['errors' => ['code']]]);

        // Non-existent manager_id
        $this->withToken($token)
            ->postJson('/api/v1/departments', [
                'code' => 'QA',
                'name' => 'Quality Assurance',
                'manager_id' => 999999,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['status', 'message', 'data' => ['errors' => ['manager_id']]]);

        // Update code to another existing department's code must fail
        $ops = Department::where('code', 'OPS')->firstOrFail();
        $this->withToken($token)
            ->putJson("/api/v1/departments/{$ops->id}", [
                'code' => 'ENG',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error');
    }

    public function test_admin_cannot_delete_department_referenced_by_employees_or_tasks(): void
    {
        $token = $this->admin->createToken('test')->plainTextToken;

        // Referenced by employees (ENG has seeded employees)
        $eng = Department::where('code', 'ENG')->firstOrFail();
        $this->withToken($token)
            ->deleteJson("/api/v1/departments/{$eng->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('departments', ['id' => $eng->id]);

        // Department with 0 employees, but referenced by a task
        $taskDept = Department::create([
            'code' => 'RND',
            'name' => 'Riset & Pengembangan',
            'description' => 'Unit eksperimen internal',
        ]);

        $creator = Employee::where('employee_code', 'EMP-002')->firstOrFail();

        Task::create([
            'department_id' => $taskDept->id,
            'created_by' => $creator->id,
            'title' => 'Evaluasi Kepatuhan PP 35/2021',
            'description' => 'Review beban jam kerja.',
            'estimated_hours' => 8,
            'priority' => 'medium',
            'due_date' => '2026-12-01',
            'status' => 'open',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/departments/{$taskDept->id}")
            ->assertConflict()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('departments', ['id' => $taskDept->id]);
    }

    public function test_rbac_manager_has_read_only_access_to_departments(): void
    {
        $managerToken = $this->manager->createToken('mgr')->plainTextToken;
        $eng = Department::where('code', 'ENG')->firstOrFail();

        $this->withToken($managerToken)
            ->getJson('/api/v1/departments')
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->withToken($managerToken)
            ->getJson("/api/v1/departments/{$eng->id}")
            ->assertOk()
            ->assertJsonPath('data.code', 'ENG');

        $this->withToken($managerToken)
            ->postJson('/api/v1/departments', [
                'code' => 'MGR-NEW',
                'name' => 'Blocked Manager Create',
            ])
            ->assertForbidden();

        $this->withToken($managerToken)
            ->putJson("/api/v1/departments/{$eng->id}", [
                'name' => 'Blocked Manager Update',
            ])
            ->assertForbidden();

        $this->withToken($managerToken)
            ->deleteJson("/api/v1/departments/{$eng->id}")
            ->assertForbidden();
    }

    public function test_rbac_employee_and_guest_are_blocked_from_department_management(): void
    {
        $eng = Department::where('code', 'ENG')->firstOrFail();

        // Guest (401)
        $this->getJson('/api/v1/departments')->assertUnauthorized();
        $this->postJson('/api/v1/departments', [])->assertUnauthorized();

        // Employee (403)
        $employeeToken = $this->employeeUser->createToken('emp')->plainTextToken;

        $this->withToken($employeeToken)->getJson('/api/v1/departments')->assertForbidden();
        $this->withToken($employeeToken)->getJson("/api/v1/departments/{$eng->id}")->assertForbidden();
        $this->withToken($employeeToken)->postJson('/api/v1/departments', [
            'code' => 'EMP-BLK',
            'name' => 'Blocked',
        ])->assertForbidden();
        $this->withToken($employeeToken)->putJson("/api/v1/departments/{$eng->id}", [
            'name' => 'Blocked',
        ])->assertForbidden();
        $this->withToken($employeeToken)->deleteJson("/api/v1/departments/{$eng->id}")->assertForbidden();
    }
}
