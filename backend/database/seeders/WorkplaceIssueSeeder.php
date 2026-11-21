<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Employee;
use App\Models\WorkplaceIssue;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkplaceIssueSeeder extends Seeder
{
    /**
     * Seed initial workplace issues and follow-up statuses for PBI-08.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $emp3 = Employee::where('employee_code', 'EMP-003')->first();
            $emp4 = Employee::where('employee_code', 'EMP-004')->first();
            $emp5 = Employee::where('employee_code', 'EMP-005')->first();

            $engDept = Department::where('code', 'ENG')->first();
            $opsDept = Department::where('code', 'OPS')->first();

            if ($emp3 && $engDept) {
                WorkplaceIssue::firstOrCreate(
                    [
                        'reported_by' => $emp3->id,
                        'category' => 'Beban Kerja',
                        'description' => 'Jadwal rilis fitur bersamaan dengan masa audit membuat estimasi waktu pengerjaan terasa padat dan perlu penyesuaian prioritas.',
                    ],
                    [
                        'department_id' => $engDept->id,
                        'status' => 'open',
                        'resolution_notes' => null,
                        'resolved_at' => null,
                    ]
                );

                WorkplaceIssue::firstOrCreate(
                    [
                        'reported_by' => $emp3->id,
                        'category' => 'Fasilitas & Ergonomi',
                        'description' => 'Pencahayaan di area meja pengembangan lantai dua agak redup saat sore hari sehingga mengurangi kenyamanan kerja.',
                    ],
                    [
                        'department_id' => $engDept->id,
                        'status' => 'resolved',
                        'resolution_notes' => 'Tim fasilitas telah mengganti unit lampu LED dan menambahkan lampu meja ergonomis pada workstation terkait.',
                        'resolved_at' => now()->subDays(4),
                    ]
                );
            }

            if ($emp4 && $opsDept) {
                WorkplaceIssue::firstOrCreate(
                    [
                        'reported_by' => $emp4->id,
                        'category' => 'Jadwal & Lembur',
                        'description' => 'Pergantian shift akhir pekan sering terlambat diumumkan sehingga menyulitkan koordinasi waktu istirahat pegawai operasional.',
                    ],
                    [
                        'department_id' => $opsDept->id,
                        'status' => 'in_progress',
                        'resolution_notes' => 'Manajer operasional sedang menyusun template jadwal shift bergilir maksimal H-5 sebelum pergantian minggu.',
                        'resolved_at' => null,
                    ]
                );
            }

            if ($emp5 && $opsDept) {
                WorkplaceIssue::firstOrCreate(
                    [
                        'reported_by' => $emp5->id,
                        'category' => 'Komunikasi Tim',
                        'description' => 'Serah terima tiket dukungan pelanggan antar shift pagi dan siang belum memiliki ringkasan status yang seragam.',
                    ],
                    [
                        'department_id' => $opsDept->id,
                        'status' => 'resolved',
                        'resolution_notes' => 'Template catatan serah terima harian telah diterapkan pada rapat sinkronisasi 10 menit pergantian shift.',
                        'resolved_at' => now()->subDays(1),
                    ]
                );
            }
        });
    }
}
