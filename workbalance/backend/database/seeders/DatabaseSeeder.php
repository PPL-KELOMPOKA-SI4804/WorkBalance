<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Position;
use App\Models\UserAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with initial WorkBalance master data.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $tetap = EmploymentType::firstOrCreate(
                ['name' => 'Tetap (PKWTT)'],
                ['work_days_per_week' => 5, 'normal_weekly_hours' => 40]
            );

            $kontrak = EmploymentType::firstOrCreate(
                ['name' => 'Kontrak (PKWT)'],
                ['work_days_per_week' => 5, 'normal_weekly_hours' => 40]
            );

            $magang = EmploymentType::firstOrCreate(
                ['name' => 'Magang / Shift'],
                ['work_days_per_week' => 6, 'normal_weekly_hours' => 40]
            );

            $engDept = Department::firstOrCreate(
                ['code' => 'ENG'],
                ['name' => 'Rekayasa Perangkat Lunak', 'description' => 'Pengembangan produk dan infrastruktur teknologi']
            );

            $opsDept = Department::firstOrCreate(
                ['code' => 'OPS'],
                ['name' => 'Operasional & Layanan', 'description' => 'Operasional harian dan dukungan pelanggan']
            );

            $hrdDept = Department::firstOrCreate(
                ['code' => 'HRD'],
                ['name' => 'Sumber Daya Manusia & Kepatuhan', 'description' => 'Administrasi pegawai dan kepatuhan ketenagakerjaan']
            );

            $engManagerPos = Position::firstOrCreate(
                ['title' => 'Engineering Manager'],
                ['level' => 'Manager', 'description' => 'Pengelola tim engineering dan distribusi beban kerja']
            );

            $seniorEngPos = Position::firstOrCreate(
                ['title' => 'Senior Software Engineer'],
                ['level' => 'Senior', 'description' => 'Pengembangan fitur inti dan arsitektur sistem']
            );

            $opsSpecPos = Position::firstOrCreate(
                ['title' => 'Operations Specialist'],
                ['level' => 'Staff', 'description' => 'Pelaksana operasional dan penanganan insiden layanan']
            );

            $hrAdminPos = Position::firstOrCreate(
                ['title' => 'HR Administrator'],
                ['level' => 'Administrator', 'description' => 'Pengelola data master pegawai dan kebijakan sistem']
            );

            $defaultPassword = Hash::make('password123');

            $seedUsers = [
                [
                    'email' => 'admin@workbalance.id',
                    'role' => 'admin',
                    'employee_code' => 'EMP-001',
                    'full_name' => 'Nadira Kusuma',
                    'department_id' => $hrdDept->id,
                    'position_id' => $hrAdminPos->id,
                    'employment_type_id' => $tetap->id,
                    'join_date' => '2024-01-15',
                ],
                [
                    'email' => 'manager@workbalance.id',
                    'role' => 'manager',
                    'employee_code' => 'EMP-002',
                    'full_name' => 'Raka Pratama',
                    'department_id' => $engDept->id,
                    'position_id' => $engManagerPos->id,
                    'employment_type_id' => $tetap->id,
                    'join_date' => '2024-02-01',
                    'manages_department' => $engDept,
                ],
                [
                    'email' => 'pegawai1@workbalance.id',
                    'role' => 'employee',
                    'employee_code' => 'EMP-003',
                    'full_name' => 'Alya Permata',
                    'department_id' => $engDept->id,
                    'position_id' => $seniorEngPos->id,
                    'employment_type_id' => $tetap->id,
                    'join_date' => '2024-05-10',
                ],
                [
                    'email' => 'pegawai2@workbalance.id',
                    'role' => 'employee',
                    'employee_code' => 'EMP-004',
                    'full_name' => 'Bima Wijaya',
                    'department_id' => $opsDept->id,
                    'position_id' => $opsSpecPos->id,
                    'employment_type_id' => $kontrak->id,
                    'join_date' => '2025-01-20',
                ],
                [
                    'email' => 'pegawai3@workbalance.id',
                    'role' => 'employee',
                    'employee_code' => 'EMP-005',
                    'full_name' => 'Citra Lestari',
                    'department_id' => $opsDept->id,
                    'position_id' => $opsSpecPos->id,
                    'employment_type_id' => $magang->id,
                    'join_date' => '2026-03-01',
                ],
            ];

            foreach ($seedUsers as $entry) {
                $account = UserAccount::firstOrCreate(
                    ['email' => $entry['email']],
                    [
                        'password_hash' => $defaultPassword,
                        'role' => $entry['role'],
                        'is_active' => true,
                    ]
                );

                $employee = Employee::firstOrCreate(
                    ['employee_code' => $entry['employee_code']],
                    [
                        'user_account_id' => $account->id,
                        'department_id' => $entry['department_id'],
                        'position_id' => $entry['position_id'],
                        'employment_type_id' => $entry['employment_type_id'],
                        'full_name' => $entry['full_name'],
                        'join_date' => $entry['join_date'],
                        'status' => 'active',
                    ]
                );

                if (isset($entry['manages_department'])) {
                    $entry['manages_department']->update(['manager_id' => $employee->id]);
                }
            }
        });
    }
}
