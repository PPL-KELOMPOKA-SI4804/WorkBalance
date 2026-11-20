<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Position;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\Training;
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

            $managerEmployee = Employee::where('employee_code', 'EMP-002')->first();

            if ($managerEmployee) {
                $seedTasks = [
                    [
                        'title' => 'Integrasi Modul Autentikasi Sanctum & RBAC',
                        'department_id' => $engDept->id,
                        'description' => 'Memastikan proteksi rute lintas peran dan token sesi berjalan sesuai standar keamanan.',
                        'estimated_hours' => 16.00,
                        'priority' => 'critical',
                        'due_date' => now()->addDays(3)->toDateString(),
                        'status' => 'in_progress',
                    ],
                    [
                        'title' => 'Optimasi Kueri Agregasi Laporan Mingguan',
                        'department_id' => $engDept->id,
                        'description' => 'Mengurangi waktu eksekusi kueri ringkasan jam kerja tim pada dasbor.',
                        'estimated_hours' => 12.00,
                        'priority' => 'high',
                        'due_date' => now()->subDays(2)->toDateString(),
                        'status' => 'open',
                    ],
                    [
                        'title' => 'Audit Prosedur Eskalasi Insiden Layanan',
                        'department_id' => $opsDept->id,
                        'description' => 'Meninjau ulang SOP penanganan tiket darurat dan jam operasional shift.',
                        'estimated_hours' => 8.50,
                        'priority' => 'medium',
                        'due_date' => now()->addDays(14)->toDateString(),
                        'status' => 'open',
                    ],
                    [
                        'title' => 'Penyusunan Template Onboarding Pegawai Baru',
                        'department_id' => $opsDept->id,
                        'description' => 'Menyusun panduan pengisian work log harian dan pengenalan aturan PP 35/2021.',
                        'estimated_hours' => 6.00,
                        'priority' => 'low',
                        'due_date' => now()->subDays(5)->toDateString(),
                        'status' => 'completed',
                    ],
                ];

                foreach ($seedTasks as $taskData) {
                    Task::firstOrCreate(
                        [
                            'title' => $taskData['title'],
                            'department_id' => $taskData['department_id'],
                        ],
                        [
                            'created_by' => $managerEmployee->id,
                            'description' => $taskData['description'],
                            'estimated_hours' => $taskData['estimated_hours'],
                            'priority' => $taskData['priority'],
                            'due_date' => $taskData['due_date'],
                            'status' => $taskData['status'],
                        ]
                    );
                }

                $emp3 = Employee::where('employee_code', 'EMP-003')->first();
                $emp4 = Employee::where('employee_code', 'EMP-004')->first();
                $emp5 = Employee::where('employee_code', 'EMP-005')->first();

                $task1 = Task::where('title', 'Integrasi Modul Autentikasi Sanctum & RBAC')->first();
                $task2 = Task::where('title', 'Optimasi Kueri Agregasi Laporan Mingguan')->first();
                $task3 = Task::where('title', 'Audit Prosedur Eskalasi Insiden Layanan')->first();
                $task4 = Task::where('title', 'Penyusunan Template Onboarding Pegawai Baru')->first();

                $seedAssignments = [
                    [
                        'task' => $task1,
                        'employee' => $emp3,
                        'deadline' => now()->addDays(3)->toDateString(),
                        'status' => 'in_progress',
                    ],
                    [
                        'task' => $task2,
                        'employee' => $emp3,
                        'deadline' => now()->subDays(2)->toDateString(),
                        'status' => 'assigned',
                    ],
                    [
                        'task' => $task3,
                        'employee' => $emp4,
                        'deadline' => now()->addDays(14)->toDateString(),
                        'status' => 'assigned',
                    ],
                    [
                        'task' => $task4,
                        'employee' => $emp5,
                        'deadline' => now()->subDays(5)->toDateString(),
                        'status' => 'completed',
                    ],
                ];

                foreach ($seedAssignments as $assignData) {
                    if ($assignData['task'] && $assignData['employee']) {
                        TaskAssignment::firstOrCreate(
                            [
                                'task_id' => $assignData['task']->id,
                                'employee_id' => $assignData['employee']->id,
                            ],
                            [
                                'assigned_by' => $managerEmployee->id,
                                'assigned_at' => now()->subDays(3),
                                'deadline' => $assignData['deadline'],
                                'status' => $assignData['status'],
                            ]
                        );
                    }
                }
            }

            $seedTrainings = [
                [
                    'title' => 'Arsitektur Sistem Terdistribusi & Optimasi Database',
                    'category' => 'Teknis & Rekayasa',
                    'provider' => 'WorkBalance Tech Academy',
                    'duration_hours' => 16.00,
                    'start_date' => now()->subDays(2)->toDateString(),
                    'end_date' => now()->addDays(3)->toDateString(),
                ],
                [
                    'title' => 'Keselamatan & Kesehatan Kerja (K3) Lingkungan Operasional',
                    'category' => 'Keselamatan & K3',
                    'provider' => 'Balai K3 Nasional',
                    'duration_hours' => 12.00,
                    'start_date' => now()->addDays(7)->toDateString(),
                    'end_date' => now()->addDays(9)->toDateString(),
                ],
                [
                    'title' => 'Manajemen Beban Kerja & Kepatuhan PP No. 35/2021',
                    'category' => 'Kepemimpinan & Manajemen',
                    'provider' => 'Institut SDM Indonesia',
                    'duration_hours' => 8.00,
                    'start_date' => now()->subDays(14)->toDateString(),
                    'end_date' => now()->subDays(13)->toDateString(),
                ],
                [
                    'title' => 'Manajemen Stres & Keseimbangan Kerja-Hidup (Work-Life Balance)',
                    'category' => 'Kesejahteraan & Produktivitas',
                    'provider' => 'Pusat Psikologi Terapan',
                    'duration_hours' => 6.00,
                    'start_date' => now()->addDays(15)->toDateString(),
                    'end_date' => now()->addDays(15)->toDateString(),
                ],
            ];

            foreach ($seedTrainings as $trainingData) {
                Training::firstOrCreate(
                    ['title' => $trainingData['title']],
                    [
                        'category' => $trainingData['category'],
                        'provider' => $trainingData['provider'],
                        'duration_hours' => $trainingData['duration_hours'],
                        'start_date' => $trainingData['start_date'],
                        'end_date' => $trainingData['end_date'],
                    ]
                );
            }
        });
    }
}
