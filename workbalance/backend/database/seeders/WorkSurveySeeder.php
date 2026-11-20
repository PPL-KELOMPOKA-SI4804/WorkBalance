<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\SurveyResponse;
use App\Models\WorkSurvey;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkSurveySeeder extends Seeder
{
    /**
     * Seed initial work condition surveys and sample responses for PBI-07.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $emp3 = Employee::where('employee_code', 'EMP-003')->first();
            $emp4 = Employee::where('employee_code', 'EMP-004')->first();

            $octSurvey = WorkSurvey::firstOrCreate(
                [
                    'title' => 'Survei Kesejahteraan & Beban Kerja Oktober 2026',
                    'period_month' => '2026-10',
                ],
                [
                    'description' => 'Evaluasi bulanan keseimbangan kehidupan-kerja dan persepsi beban kerja tim.',
                    'is_active' => false,
                ]
            );

            $novSurvey = WorkSurvey::firstOrCreate(
                [
                    'title' => 'Survei Kondisi Kerja November 2026',
                    'period_month' => '2026-11',
                ],
                [
                    'description' => 'Penilaian rutin keseimbangan kerja-hidup serta kenyamanan beban kerja bulan berjalan.',
                    'is_active' => true,
                ]
            );

            if ($emp3) {
                SurveyResponse::firstOrCreate(
                    [
                        'work_survey_id' => $octSurvey->id,
                        'employee_id' => $emp3->id,
                    ],
                    [
                        'work_life_balance_score' => 4,
                        'workload_perception_score' => 3,
                        'comments' => 'Pembagian sprint cukup terstruktur, namun beberapa tenggat berdekatan.',
                        'submitted_at' => now()->subDays(20),
                    ]
                );
            }

            if ($emp4) {
                SurveyResponse::firstOrCreate(
                    [
                        'work_survey_id' => $octSurvey->id,
                        'employee_id' => $emp4->id,
                    ],
                    [
                        'work_life_balance_score' => 3,
                        'workload_perception_score' => 4,
                        'comments' => 'Jadwal shift operasional memerlukan penyesuaian waktu istirahat.',
                        'submitted_at' => now()->subDays(19),
                    ]
                );

                SurveyResponse::firstOrCreate(
                    [
                        'work_survey_id' => $novSurvey->id,
                        'employee_id' => $emp4->id,
                    ],
                    [
                        'work_life_balance_score' => 4,
                        'workload_perception_score' => 3,
                        'comments' => 'Distribusi tugas bulan ini terasa lebih seimbang.',
                        'submitted_at' => now()->subDays(2),
                    ]
                );
            }
        });
    }
}
