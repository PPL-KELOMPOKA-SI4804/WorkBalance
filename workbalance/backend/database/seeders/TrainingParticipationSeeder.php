<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Training;
use App\Models\TrainingParticipation;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TrainingParticipationSeeder extends Seeder
{
    /**
     * Seed initial employee training participation records for PBI-06.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $emp3 = Employee::where('employee_code', 'EMP-003')->first();
            $emp4 = Employee::where('employee_code', 'EMP-004')->first();
            $emp5 = Employee::where('employee_code', 'EMP-005')->first();

            $t1 = Training::where('title', 'Arsitektur Sistem Terdistribusi & Optimasi Database')->first();
            $t2 = Training::where('title', 'Keselamatan & Kesehatan Kerja (K3) Lingkungan Operasional')->first();
            $t3 = Training::where('title', 'Manajemen Beban Kerja & Kepatuhan PP No. 35/2021')->first();
            $t4 = Training::where('title', 'Manajemen Stres & Keseimbangan Kerja-Hidup (Work-Life Balance)')->first();

            $entries = [
                [
                    'training' => $t1,
                    'employee' => $emp3,
                    'status' => 'enrolled',
                    'completion_date' => null,
                ],
                [
                    'training' => $t3,
                    'employee' => $emp3,
                    'status' => 'completed',
                    'completion_date' => now()->subDays(13)->toDateString(),
                ],
                [
                    'training' => $t2,
                    'employee' => $emp4,
                    'status' => 'enrolled',
                    'completion_date' => null,
                ],
                [
                    'training' => $t4,
                    'employee' => $emp5,
                    'status' => 'dropped',
                    'completion_date' => null,
                ],
            ];

            foreach ($entries as $entry) {
                if ($entry['training'] && $entry['employee']) {
                    TrainingParticipation::firstOrCreate(
                        [
                            'training_id' => $entry['training']->id,
                            'employee_id' => $entry['employee']->id,
                        ],
                        [
                            'status' => $entry['status'],
                            'completion_date' => $entry['completion_date'],
                        ]
                    );
                }
            }
        });
    }
}
