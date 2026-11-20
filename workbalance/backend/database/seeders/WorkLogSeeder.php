<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\WorkLog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkLogSeeder extends Seeder
{
    /**
     * Seed initial employee work log records linked to seeded task assignments for PBI-09.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $emp3 = Employee::where('employee_code', 'EMP-003')->first();
            $emp4 = Employee::where('employee_code', 'EMP-004')->first();
            $emp5 = Employee::where('employee_code', 'EMP-005')->first();

            $task1 = Task::where('title', 'Integrasi Modul Autentikasi Sanctum & RBAC')->first();
            $task2 = Task::where('title', 'Optimasi Kueri Agregasi Laporan Mingguan')->first();
            $task3 = Task::where('title', 'Audit Prosedur Eskalasi Insiden Layanan')->first();
            $task4 = Task::where('title', 'Penyusunan Template Onboarding Pegawai Baru')->first();

            if ($emp3 && $task1) {
                $assign1 = TaskAssignment::where('task_id', $task1->id)
                    ->where('employee_id', $emp3->id)
                    ->first();

                if ($assign1) {
                    WorkLog::firstOrCreate(
                        [
                            'employee_id' => $emp3->id,
                            'task_assignment_id' => $assign1->id,
                            'activity_description' => 'Implementasi middleware role-based access control dan integrasi token Sanctum pada endpoint inti.',
                        ],
                        [
                            'work_date' => now()->subDays(2)->toDateString(),
                            'hours_spent' => 7.50,
                        ]
                    );

                    WorkLog::firstOrCreate(
                        [
                            'employee_id' => $emp3->id,
                            'task_assignment_id' => $assign1->id,
                            'activity_description' => 'Pengujian end-to-end otorisasi lintas peran Admin, Manajer, dan Pegawai beserta skenario batas akses.',
                        ],
                        [
                            'work_date' => now()->subDays(1)->toDateString(),
                            'hours_spent' => 6.50,
                        ]
                    );
                }
            }

            if ($emp3 && $task2) {
                $assign2 = TaskAssignment::where('task_id', $task2->id)
                    ->where('employee_id', $emp3->id)
                    ->first();

                if ($assign2) {
                    WorkLog::firstOrCreate(
                        [
                            'employee_id' => $emp3->id,
                            'task_assignment_id' => $assign2->id,
                            'activity_description' => 'Profiling indeks kueri ringkasan mingguan dan perancangan ulang skema agregasi departemen.',
                        ],
                        [
                            'work_date' => now()->toDateString(),
                            'hours_spent' => 4.00,
                        ]
                    );
                }
            }

            if ($emp4 && $task3) {
                $assign3 = TaskAssignment::where('task_id', $task3->id)
                    ->where('employee_id', $emp4->id)
                    ->first();

                if ($assign3) {
                    WorkLog::firstOrCreate(
                        [
                            'employee_id' => $emp4->id,
                            'task_assignment_id' => $assign3->id,
                            'activity_description' => 'Audit dokumen alur eskalasi insiden operasional lintas shift beserta simulasi respon insiden prioritas.',
                        ],
                        [
                            'work_date' => now()->subDays(1)->toDateString(),
                            'hours_spent' => 9.00,
                        ]
                    );
                }
            }

            if ($emp5 && $task4) {
                $assign4 = TaskAssignment::where('task_id', $task4->id)
                    ->where('employee_id', $emp5->id)
                    ->first();

                if ($assign4) {
                    WorkLog::firstOrCreate(
                        [
                            'employee_id' => $emp5->id,
                            'task_assignment_id' => $assign4->id,
                            'activity_description' => 'Penyusunan panduan pengisian work log harian pegawai baru dan ringkasan aturan jam kerja PP No. 35/2021.',
                        ],
                        [
                            'work_date' => now()->subDays(6)->toDateString(),
                            'hours_spent' => 6.00,
                        ]
                    );
                }
            }
        });
    }
}
