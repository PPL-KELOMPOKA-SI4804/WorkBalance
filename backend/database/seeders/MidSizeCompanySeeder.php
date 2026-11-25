<?php

namespace Database\Seeders;

use App\Models\Compensation;
use App\Models\Competency;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeCompetency;
use App\Models\EmploymentType;
use App\Models\LeaveRequest;
use App\Models\Overtime;
use App\Models\Position;
use App\Models\SafetyIncident;
use App\Models\SurveyResponse;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\Training;
use App\Models\TrainingParticipation;
use App\Models\UserAccount;
use App\Models\WorkLog;
use App\Models\WorkplaceIssue;
use App\Models\WorkSurvey;
use App\Services\WorkloadRiskService;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class MidSizeCompanySeeder extends Seeder
{
    /**
     * Seed realistic mid-size Indonesian enterprise data (~70 employees, 10 departments)
     * idempotently on top of baseline DatabaseSeeder demo accounts.
     */
    public function run(): void
    {
        // Keep baseline demo accounts & core entities intact (EMP-001..EMP-005)
        $this->call([
            DatabaseSeeder::class,
            WorkLogSeeder::class,
            TrainingParticipationSeeder::class,
            WorkSurveySeeder::class,
            WorkplaceIssueSeeder::class,
        ]);

        $currentWeekStart = now()->startOfWeek(CarbonInterface::MONDAY);
        $prevWeekStart = $currentWeekStart->copy()->subWeek();
        $currentPeriodWeek = $currentWeekStart->format('o-\WW');
        $prevPeriodWeek = $prevWeekStart->format('o-\WW');
        $currentPeriodMonth = now()->format('Y-m');
        $prevPeriodMonth = now()->copy()->subMonthNoOverflow()->format('Y-m');

        DB::transaction(function () use (
            $currentWeekStart,
            $prevWeekStart,
            $currentPeriodMonth,
            $prevPeriodMonth
        ) {
            $employmentTypes = $this->seedEmploymentTypes();
            $departments = $this->seedDepartments();
            $positions = $this->seedPositions();
            $employees = $this->seedEmployees($departments, $positions, $employmentTypes);

            $this->assignDepartmentManagers($departments, $employees);
            $tasks = $this->seedTasks($departments, $employees);
            $assignments = $this->seedTaskAssignments($tasks, $employees, $departments);
            $this->seedWorkLogs($employees, $assignments, $currentWeekStart, $prevWeekStart);
            $this->seedOvertimesAndLeaves($employees, $departments, $currentWeekStart);
            $trainings = $this->seedTrainings();
            $this->seedTrainingParticipations($trainings, $employees);
            $this->seedSurveysAndResponses($employees, $currentPeriodMonth, $prevPeriodMonth);
            $this->seedWorkplaceIssuesAndSafety($employees, $departments);
            $this->seedCompensations($employees, $currentPeriodMonth, $prevPeriodMonth);
            $this->seedCompetencies($employees);
        });

        // Recalculate Workload Risk for current and previous week for all active employees
        $actor = UserAccount::whereIn('role', ['manager', 'admin'])->first();
        if ($actor) {
            $riskService = app(WorkloadRiskService::class);
            $riskService->calculate(['period_week' => $prevPeriodWeek], $actor);
            $riskService->calculate(['period_week' => $currentPeriodWeek], $actor);
        }
    }

    /**
     * @return array<string, EmploymentType>
     */
    private function seedEmploymentTypes(): array
    {
        $defs = [
            'tetap' => ['name' => 'Tetap (PKWTT)', 'work_days_per_week' => 5, 'normal_weekly_hours' => 40],
            'kontrak' => ['name' => 'Kontrak (PKWT)', 'work_days_per_week' => 5, 'normal_weekly_hours' => 40],
            'magang' => ['name' => 'Magang / Shift', 'work_days_per_week' => 6, 'normal_weekly_hours' => 40],
            'shift6' => ['name' => 'Operasional Shift 6 Hari', 'work_days_per_week' => 6, 'normal_weekly_hours' => 40],
        ];

        $result = [];
        foreach ($defs as $key => $def) {
            $result[$key] = EmploymentType::firstOrCreate(
                ['name' => $def['name']],
                [
                    'work_days_per_week' => $def['work_days_per_week'],
                    'normal_weekly_hours' => $def['normal_weekly_hours'],
                ]
            );
        }

        return $result;
    }

    /**
     * @return array<string, Department>
     */
    private function seedDepartments(): array
    {
        $defs = [
            ['code' => 'ENG', 'name' => 'Rekayasa Perangkat Lunak', 'description' => 'Pengembangan produk inti, arsitektur layanan, dan integrasi API perusahaan.'],
            ['code' => 'OPS', 'name' => 'Operasional & Layanan', 'description' => 'Pengelolaan operasional harian, dukungan pelanggan, dan kontrol SLA layanan.'],
            ['code' => 'HRD', 'name' => 'Sumber Daya Manusia & Kepatuhan', 'description' => 'Manajemen talenta, pengembangan kompetensi, kesejahteraan pegawai, dan kepatuhan PP 35/2021.'],
            ['code' => 'PRD', 'name' => 'Manajemen Produk & Desain', 'description' => 'Riset pengguna, perencanaan peta jalan produk, serta desain antarmuka UI/UX.'],
            ['code' => 'QA', 'name' => 'Penjaminan Mutu & Keandalan', 'description' => 'Pengujian otomatis, kontrol kualitas rilis, dan stabilitas layanan produksi.'],
            ['code' => 'FIN', 'name' => 'Keuangan, Akuntansi & Pajak', 'description' => 'Pengelolaan anggaran operasional, pembukuan PSAK, audit internal, dan kepatuhan perpajakan.'],
            ['code' => 'MKT', 'name' => 'Pemasaran & Pertumbuhan', 'description' => 'Strategi merek, pemasaran digital, kampanye akuisisi, dan komunikasi publik.'],
            ['code' => 'SLS', 'name' => 'Penjualan & Kemitraan B2B', 'description' => 'Akuisisi klien korporasi, pengelolaan akun strategis, dan kemitraan distribusi.'],
            ['code' => 'ITX', 'name' => 'Infrastruktur TI & Keamanan Siber', 'description' => 'Pengelolaan server cloud, jaringan korporasi, keandalan DevOps, dan keamanan informasi.'],
            ['code' => 'GAF', 'name' => 'Umum, Fasilitas & K3', 'description' => 'Pengelolaan aset kantor, ergonomi ruang kerja, logistik, dan keselamatan kesehatan kerja (K3).'],
        ];

        $result = [];
        foreach ($defs as $def) {
            $result[$def['code']] = Department::firstOrCreate(
                ['code' => $def['code']],
                [
                    'name' => $def['name'],
                    'description' => $def['description'],
                ]
            );
        }

        return $result;
    }

    /**
     * @return array<string, Position>
     */
    private function seedPositions(): array
    {
        $defs = [
            'eng_mgr' => ['Engineering Manager', 'Manager', 'Pengelola tim engineering dan distribusi beban kerja'],
            'sr_eng' => ['Senior Software Engineer', 'Senior', 'Pengembangan fitur inti dan arsitektur sistem'],
            'be_eng' => ['Backend Software Engineer', 'Staff', 'Pengembangan layanan API dan basis data'],
            'fe_eng' => ['Frontend Software Engineer', 'Staff', 'Pengembangan antarmuka aplikasi web dan aksesibilitas'],
            'ops_mgr' => ['Operations Manager', 'Manager', 'Pengelola operasional harian, shift, dan standar layanan'],
            'ops_spec' => ['Operations Specialist', 'Staff', 'Pelaksana operasional dan penanganan insiden layanan'],
            'cs_lead' => ['Customer Support Lead', 'Lead', 'Koordinator dukungan pelanggan dan eskalasi tiket'],
            'hr_admin' => ['HR Administrator', 'Administrator', 'Pengelola data master pegawai dan kebijakan sistem'],
            'hr_bp' => ['HR Business Partner', 'Senior', 'Mitra strategis kesejahteraan pegawai dan evaluasi organisasi'],
            'ld_spec' => ['Learning & Development Specialist', 'Staff', 'Pengelola program pelatihan dan pemetaan kompetensi'],
            'prod_mgr' => ['Product Manager', 'Manager', 'Perencana peta jalan produk dan prioritas rilis'],
            'ux_des' => ['Senior UI/UX Designer', 'Senior', 'Perancang pengalaman pengguna dan sistem desain'],
            'prod_an' => ['Product Analyst', 'Staff', 'Analis metrik penggunaan produk dan validasi fitur'],
            'qa_mgr' => ['QA Engineering Manager', 'Manager', 'Pengelola strategi pengujian dan mutu rilis produk'],
            'qa_auto' => ['QA Automation Engineer', 'Senior', 'Pengembang skrip pengujian otomatis end-to-end'],
            'qa_an' => ['Quality Assurance Analyst', 'Staff', 'Pelaksana pengujian regresi dan validasi tiket cacat'],
            'fin_mgr' => ['Finance & Accounting Manager', 'Manager', 'Pengelola pelaporan keuangan, pajak, dan audit'],
            'sr_acc' => ['Senior Accountant', 'Senior', 'Penyusun laporan keuangan bulanan dan rekonsiliasi'],
            'tax_spec' => ['Tax & Compliance Specialist', 'Staff', 'Pengelola kepatuhan pajak bulanan dan tahunan'],
            'mkt_mgr' => ['Marketing Manager', 'Manager', 'Pengarah kampanye pertumbuhan dan komunikasi merek'],
            'perf_mkt' => ['Digital Marketing Specialist', 'Staff', 'Pengelola kampanye akuisisi digital dan analitik'],
            'sls_mgr' => ['B2B Sales Manager', 'Manager', 'Pengelola target penjualan korporasi dan kemitraan'],
            'acct_exec' => ['Account Executive', 'Staff', 'Pengelola prospek B2B, negosiasi, dan retensi klien'],
            'itx_mgr' => ['IT Infrastructure & Security Manager', 'Manager', 'Pengelola infrastruktur cloud, jaringan, dan keamanan siber'],
            'devops' => ['DevOps & Site Reliability Engineer', 'Senior', 'Pengelola pipeline CI/CD, pemantauan server, dan respons insiden'],
            'gaf_mgr' => ['General Affairs & K3 Manager', 'Manager', 'Pengelola fasilitas kantor, logistik, dan keselamatan kerja'],
            'k3_off' => ['HSE & Facility Officer', 'Staff', 'Pelaksana inspeksi K3, ergonomi, dan perawatan fasilitas'],
            'intern' => ['Management Trainee / Intern', 'Intern', 'Peserta program pemagangan lintas fungsi perusahaan'],
        ];

        $result = [];
        foreach ($defs as $key => [$title, $level, $desc]) {
            $result[$key] = Position::firstOrCreate(
                ['title' => $title],
                ['level' => $level, 'description' => $desc]
            );
        }

        return $result;
    }

    /**
     * @param  array<string, Department>  $departments
     * @param  array<string, Position>  $positions
     * @param  array<string, EmploymentType>  $employmentTypes
     * @return array<string, Employee>
     */
    private function seedEmployees(array $departments, array $positions, array $employmentTypes): array
    {
        $passwordHash = Hash::make('password123');

        // 65 additional employees (EMP-006..EMP-070) -> total 70 employees across 10 departments
        $roster = [
            // Department Managers (EMP-006..EMP-013)
            ['EMP-006', 'Dimas Mahendra', 'dimas.mahendra@workbalance.id', 'manager', 'OPS', 'ops_mgr', 'tetap', '2022-03-14', 'active'],
            ['EMP-007', 'Larasati Wibowo', 'larasati.wibowo@workbalance.id', 'manager', 'PRD', 'prod_mgr', 'tetap', '2022-06-01', 'active'],
            ['EMP-008', 'Hendra Gunawan', 'hendra.gunawan@workbalance.id', 'manager', 'QA', 'qa_mgr', 'tetap', '2022-08-15', 'active'],
            ['EMP-009', 'Dewi Anggraini', 'dewi.anggraini@workbalance.id', 'manager', 'FIN', 'fin_mgr', 'tetap', '2021-11-01', 'active'],
            ['EMP-010', 'Farhan Hidayat', 'farhan.hidayat@workbalance.id', 'manager', 'MKT', 'mkt_mgr', 'tetap', '2023-01-09', 'active'],
            ['EMP-011', 'Bagus Setiawan', 'bagus.setiawan@workbalance.id', 'manager', 'SLS', 'sls_mgr', 'tetap', '2022-04-18', 'active'],
            ['EMP-012', 'Reza Firmansyah', 'reza.firmansyah@workbalance.id', 'manager', 'ITX', 'itx_mgr', 'tetap', '2021-09-06', 'active'],
            ['EMP-013', 'Yuni Kartika', 'yuni.kartika@workbalance.id', 'manager', 'GAF', 'gaf_mgr', 'tetap', '2022-02-07', 'active'],

            // ENG (10 more -> total 12 with EMP-002 & EMP-003)
            ['EMP-014', 'Satria Nugroho', 'satria.nugroho@workbalance.id', 'employee', 'ENG', 'sr_eng', 'tetap', '2022-07-04', 'active'],
            ['EMP-015', 'Nabila Rahmawati', 'nabila.rahmawati@workbalance.id', 'employee', 'ENG', 'be_eng', 'tetap', '2023-02-13', 'active'],
            ['EMP-016', 'Ilham Saputra', 'ilham.saputra@workbalance.id', 'employee', 'ENG', 'fe_eng', 'tetap', '2023-05-22', 'active'],
            ['EMP-017', 'Tania Oktaviani', 'tania.oktaviani@workbalance.id', 'employee', 'ENG', 'be_eng', 'tetap', '2023-09-04', 'active'],
            ['EMP-018', 'Fajar Kurniawan', 'fajar.kurniawan@workbalance.id', 'employee', 'ENG', 'sr_eng', 'tetap', '2022-10-17', 'active'],
            ['EMP-019', 'Gita Puspitasari', 'gita.puspitasari@workbalance.id', 'employee', 'ENG', 'fe_eng', 'kontrak', '2024-06-10', 'active'],
            ['EMP-020', 'Kevin Pranata', 'kevin.pranata@workbalance.id', 'employee', 'ENG', 'be_eng', 'kontrak', '2024-08-19', 'active'],
            ['EMP-021', 'Putri Maharani', 'putri.maharani@workbalance.id', 'employee', 'ENG', 'fe_eng', 'tetap', '2024-03-04', 'active'],
            ['EMP-022', 'Rizky Ramadhan', 'rizky.ramadhan@workbalance.id', 'employee', 'ENG', 'intern', 'magang', '2026-02-02', 'active'],

            // OPS (7 more -> total 10 with EMP-004, EMP-005, EMP-006)
            ['EMP-023', 'Arif Budiman', 'arif.budiman@workbalance.id', 'employee', 'OPS', 'cs_lead', 'tetap', '2022-05-09', 'active'],
            ['EMP-024', 'Sinta Wulandari', 'sinta.wulandari@workbalance.id', 'employee', 'OPS', 'ops_spec', 'shift6', '2023-04-03', 'active'],
            ['EMP-025', 'Wahyu Prasetyo', 'wahyu.prasetyo@workbalance.id', 'employee', 'OPS', 'ops_spec', 'shift6', '2023-07-17', 'active'],
            ['EMP-026', 'Dina Permatasari', 'dina.permatasari@workbalance.id', 'employee', 'OPS', 'ops_spec', 'kontrak', '2024-09-02', 'active'],
            ['EMP-027', 'Teguh Santoso', 'teguh.santoso@workbalance.id', 'employee', 'OPS', 'ops_spec', 'shift6', '2024-04-15', 'active'],
            ['EMP-028', 'Maya Sari Dewi', 'maya.sari@workbalance.id', 'employee', 'OPS', 'ops_spec', 'tetap', '2023-11-06', 'active'],
            ['EMP-029', 'Yoga Pratama Putra', 'yoga.pratama@workbalance.id', 'employee', 'OPS', 'ops_spec', 'kontrak', '2025-03-10', 'active'],

            // HRD (5 more -> total 6 with EMP-001)
            ['EMP-030', 'Anisa Febrianti', 'anisa.febrianti@workbalance.id', 'employee', 'HRD', 'hr_bp', 'tetap', '2022-09-12', 'active'],
            ['EMP-031', 'Bayu Aji Laksono', 'bayu.laksono@workbalance.id', 'employee', 'HRD', 'ld_spec', 'tetap', '2023-06-19', 'active'],
            ['EMP-032', 'Ratna Kusumaningrum', 'ratna.kusuma@workbalance.id', 'employee', 'HRD', 'hr_bp', 'tetap', '2023-03-06', 'active'],
            ['EMP-033', 'Nadia Salsabila', 'nadia.salsabila@workbalance.id', 'employee', 'HRD', 'ld_spec', 'kontrak', '2025-01-13', 'active'],
            ['EMP-034', 'Galih Pradana', 'galih.pradana@workbalance.id', 'admin', 'HRD', 'hr_admin', 'tetap', '2024-07-01', 'active'],

            // PRD (6 more -> total 7 with EMP-007)
            ['EMP-035', 'Clarissa Tanuwijaya', 'clarissa.tanuwijaya@workbalance.id', 'employee', 'PRD', 'ux_des', 'tetap', '2022-11-14', 'active'],
            ['EMP-036', 'Aditya Maheswara', 'aditya.maheswara@workbalance.id', 'employee', 'PRD', 'prod_an', 'tetap', '2023-08-21', 'active'],
            ['EMP-037', 'Vina Oktavia', 'vina.oktavia@workbalance.id', 'employee', 'PRD', 'ux_des', 'tetap', '2024-01-08', 'active'],
            ['EMP-038', 'Rama Yudhistira', 'rama.yudhistira@workbalance.id', 'employee', 'PRD', 'prod_an', 'kontrak', '2025-02-03', 'active'],
            ['EMP-039', 'Shinta Melati', 'shinta.melati@workbalance.id', 'employee', 'PRD', 'ux_des', 'kontrak', '2025-06-09', 'active'],
            ['EMP-040', 'Rafly Darmawan', 'rafly.darmawan@workbalance.id', 'employee', 'PRD', 'intern', 'magang', '2026-04-06', 'active'],

            // QA (5 more -> total 6 with EMP-008)
            ['EMP-041', 'Dicky Hermawan', 'dicky.hermawan@workbalance.id', 'employee', 'QA', 'qa_auto', 'tetap', '2022-12-05', 'active'],
            ['EMP-042', 'Lia Amalia', 'lia.amalia@workbalance.id', 'employee', 'QA', 'qa_auto', 'tetap', '2023-10-09', 'active'],
            ['EMP-043', 'Eko Supriyanto', 'eko.supriyanto@workbalance.id', 'employee', 'QA', 'qa_an', 'tetap', '2024-02-19', 'active'],
            ['EMP-044', 'Intan Nuraini', 'intan.nuraini@workbalance.id', 'employee', 'QA', 'qa_an', 'kontrak', '2024-11-04', 'active'],
            ['EMP-045', 'Reno Alamsyah', 'reno.alamsyah@workbalance.id', 'employee', 'QA', 'qa_an', 'kontrak', '2025-05-12', 'active'],

            // FIN (5 more -> total 6 with EMP-009)
            ['EMP-046', 'Sri Wahyuningsih', 'sri.wahyuningsih@workbalance.id', 'employee', 'FIN', 'sr_acc', 'tetap', '2021-12-01', 'active'],
            ['EMP-047', 'Hadi Wibisono', 'hadi.wibisono@workbalance.id', 'employee', 'FIN', 'tax_spec', 'tetap', '2023-01-23', 'active'],
            ['EMP-048', 'Mega Puspita', 'mega.puspita@workbalance.id', 'employee', 'FIN', 'sr_acc', 'tetap', '2023-09-18', 'active'],
            ['EMP-049', 'Taufik Hidayatullah', 'taufik.hidayatullah@workbalance.id', 'employee', 'FIN', 'tax_spec', 'kontrak', '2024-10-07', 'active'],
            ['EMP-050', 'Ayu Lestari Putri', 'ayu.lestari@workbalance.id', 'employee', 'FIN', 'tax_spec', 'tetap', '2024-04-22', 'active'],

            // MKT (5 more -> total 6 with EMP-010)
            ['EMP-051', 'Tiara Andini Putri', 'tiara.andini@workbalance.id', 'employee', 'MKT', 'perf_mkt', 'tetap', '2023-03-20', 'active'],
            ['EMP-052', 'Bintang Prakoso', 'bintang.prakoso@workbalance.id', 'employee', 'MKT', 'perf_mkt', 'tetap', '2023-11-13', 'active'],
            ['EMP-053', 'Kezia Natalia', 'kezia.natalia@workbalance.id', 'employee', 'MKT', 'perf_mkt', 'kontrak', '2024-07-15', 'active'],
            ['EMP-054', 'Fikri Maulana', 'fikri.maulana@workbalance.id', 'employee', 'MKT', 'perf_mkt', 'kontrak', '2025-04-07', 'active'],
            ['EMP-055', 'Aulia Zahra', 'aulia.zahra@workbalance.id', 'employee', 'MKT', 'intern', 'magang', '2026-05-04', 'active'],

            // SLS (6 more -> total 7 with EMP-011)
            ['EMP-056', 'Rendra Wijaksono', 'rendra.wijaksono@workbalance.id', 'employee', 'SLS', 'acct_exec', 'tetap', '2022-06-20', 'active'],
            ['EMP-057', 'Melisa Gunardi', 'melisa.gunardi@workbalance.id', 'employee', 'SLS', 'acct_exec', 'tetap', '2023-02-06', 'active'],
            ['EMP-058', 'Danang Susanto', 'danang.susanto@workbalance.id', 'employee', 'SLS', 'acct_exec', 'tetap', '2023-08-14', 'active'],
            ['EMP-059', 'Indah Permata Hati', 'indah.permata@workbalance.id', 'employee', 'SLS', 'acct_exec', 'kontrak', '2024-05-27', 'active'],
            ['EMP-060', 'Rian Febriansyah', 'rian.febriansyah@workbalance.id', 'employee', 'SLS', 'acct_exec', 'kontrak', '2025-02-17', 'active'],

            // ITX (4 more -> total 5 with EMP-012)
            ['EMP-061', 'Cahyo Utomo', 'cahyo.utomo@workbalance.id', 'employee', 'ITX', 'devops', 'tetap', '2022-01-17', 'active'],
            ['EMP-062', 'Damar Wicaksono', 'damar.wicaksono@workbalance.id', 'employee', 'ITX', 'devops', 'tetap', '2023-05-08', 'active'],
            ['EMP-063', 'Ferry Kurnia', 'ferry.kurnia@workbalance.id', 'employee', 'ITX', 'devops', 'shift6', '2024-03-18', 'active'],

            // GAF (4 more -> total 5 with EMP-013)
            ['EMP-064', 'Agus Salim', 'agus.salim@workbalance.id', 'employee', 'GAF', 'k3_off', 'shift6', '2022-07-25', 'active'],
            ['EMP-065', 'Wulan Safitri', 'wulan.safitri@workbalance.id', 'employee', 'GAF', 'k3_off', 'tetap', '2023-10-02', 'active'],
            ['EMP-066', 'Dedi Iskandar', 'dedi.iskandar@workbalance.id', 'employee', 'GAF', 'k3_off', 'shift6', '2024-08-05', 'active'],

            // Inactive Alumni / Completed Contracts (EMP-067..EMP-070) for realistic status filtering
            ['EMP-067', 'Nugraha Pratama', 'nugraha.pratama@workbalance.id', 'employee', 'ENG', 'be_eng', 'kontrak', '2023-01-10', 'inactive'],
            ['EMP-068', 'Lestari Handayani', 'lestari.handayani@workbalance.id', 'employee', 'SLS', 'acct_exec', 'kontrak', '2023-04-17', 'inactive'],
            ['EMP-069', 'Robby Kurniawan', 'robby.kurniawan@workbalance.id', 'employee', 'ITX', 'devops', 'tetap', '2022-03-07', 'inactive'],
            ['EMP-070', 'Farida Azzahra', 'farida.azzahra@workbalance.id', 'employee', 'GAF', 'k3_off', 'kontrak', '2023-06-12', 'inactive'],
        ];

        foreach ($roster as [$code, $name, $email, $role, $deptCode, $posKey, $typeKey, $joinDate, $status]) {
            $account = UserAccount::firstOrCreate(
                ['email' => $email],
                [
                    'password_hash' => $passwordHash,
                    'role' => $role,
                    'is_active' => $status === 'active',
                ]
            );

            Employee::firstOrCreate(
                ['employee_code' => $code],
                [
                    'user_account_id' => $account->id,
                    'department_id' => $departments[$deptCode]->id,
                    'position_id' => $positions[$posKey]->id,
                    'employment_type_id' => $employmentTypes[$typeKey]->id,
                    'full_name' => $name,
                    'join_date' => $joinDate,
                    'status' => $status,
                ]
            );
        }

        return Employee::query()
            ->with(['department', 'position', 'employmentType'])
            ->get()
            ->keyBy('employee_code')
            ->all();
    }

    /**
     * @param  array<string, Department>  $departments
     * @param  array<string, Employee>  $employees
     */
    private function assignDepartmentManagers(array $departments, array $employees): void
    {
        $managerMap = [
            'ENG' => 'EMP-002',
            'OPS' => 'EMP-006',
            'HRD' => 'EMP-001',
            'PRD' => 'EMP-007',
            'QA' => 'EMP-008',
            'FIN' => 'EMP-009',
            'MKT' => 'EMP-010',
            'SLS' => 'EMP-011',
            'ITX' => 'EMP-012',
            'GAF' => 'EMP-013',
        ];

        foreach ($managerMap as $deptCode => $empCode) {
            if (isset($departments[$deptCode], $employees[$empCode])) {
                $departments[$deptCode]->update(['manager_id' => $employees[$empCode]->id]);
            }
        }
    }

    /**
     * @param  array<string, Department>  $departments
     * @param  array<string, Employee>  $employees
     * @return array<string, Task>
     */
    private function seedTasks(array $departments, array $employees): array
    {
        $defs = [
            // ENG (6 new)
            ['T-ENG-1', 'ENG', 'EMP-002', 'Migrasi Layanan Notifikasi ke Antrean Asinkron', 'Memindahkan pengiriman notifikasi operasional ke queue worker agar latensi API stabil.', 24.00, 'critical', 2, 'in_progress'],
            ['T-ENG-2', 'ENG', 'EMP-002', 'Refaktorisasi Modul Pelaporan Kinerja Departemen', 'Menyederhanakan agregasi lintas kuartal dan caching laporan manajemen.', 20.00, 'high', 4, 'in_progress'],
            ['T-ENG-3', 'ENG', 'EMP-002', 'Pembaruan Sistem Design Token Dark & Light Mode', 'Menyelaraskan komponen antarmuka tabel resizable dan token kontras WCAG AA+.', 16.00, 'high', 5, 'in_progress'],
            ['T-ENG-4', 'ENG', 'EMP-002', 'Integrasi Audit Trail Perubahan Konfigurasi Sistem', 'Mencatat setiap perubahan ambang batas PP 35/2021 secara kronologis.', 14.00, 'medium', 10, 'open'],
            ['T-ENG-5', 'ENG', 'EMP-002', 'Optimasi Indeks Basis Data Tabel Work Logs', 'Menambahkan composite index untuk mempercepat kueri periode mingguan.', 10.00, 'medium', -1, 'completed'],
            ['T-ENG-6', 'ENG', 'EMP-002', 'Dokumentasi OpenAPI Endpoint Analitik v1', 'Melengkapi spesifikasi skema JSON untuk seluruh endpoint dasbor.', 8.00, 'low', 18, 'open'],

            // OPS (5 new)
            ['T-OPS-1', 'OPS', 'EMP-006', 'Penyeimbangan Jadwal Shift Operasional Akhir Bulan', 'Menyusun rotasi shift 6 hari agar kepatuhan batas lembur harian tetap terjaga.', 22.00, 'critical', 2, 'in_progress'],
            ['T-OPS-2', 'OPS', 'EMP-006', 'Evaluasi SLA Penanganan Tiket Prioritas Tinggi', 'Menganalisis waktu tanggap rata-rata insiden pelanggan selama 30 hari terakhir.', 16.00, 'high', 4, 'in_progress'],
            ['T-OPS-3', 'OPS', 'EMP-006', 'Standarisasi Serah Terima Shift Pagi dan Malam', 'Membuat checklist baku status tiket aktif pada pergantian shift.', 12.00, 'medium', 9, 'open'],
            ['T-OPS-4', 'OPS', 'EMP-006', 'Pelatihan Refreshing Prosedur Eskalasi Pelanggan', 'Sesi penyegaran penanganan keluhan pelanggan korporasi.', 10.00, 'medium', -3, 'completed'],
            ['T-OPS-5', 'OPS', 'EMP-006', 'Pemetaan Kapasitas Agen Dukungan Kuartal Depan', 'Menghitung kebutuhan kapasitas jam kerja untuk proyeksi volume tiket baru.', 14.00, 'high', 6, 'open'],

            // HRD (4 new)
            ['T-HRD-1', 'HRD', 'EMP-001', 'Audit Kepatuhan Jam Kerja & Lembur PP No. 35/2021', 'Meninjau tren lembur lintas departemen dan menyusun rekomendasi redistribusi.', 14.00, 'high', 3, 'in_progress'],
            ['T-HRD-2', 'HRD', 'EMP-001', 'Penyusunan Matriks Kompetensi Tahunan Pegawai', 'Memperbarui level target kompetensi per jabatan untuk periode semester depan.', 16.00, 'medium', 12, 'open'],
            ['T-HRD-3', 'HRD', 'EMP-001', 'Evaluasi Hasil Survei Kesejahteraan Kuartal IV', 'Menganalisis agregasi skor WLB per departemen tanpa membuka data individu.', 10.00, 'high', 5, 'in_progress'],
            ['T-HRD-4', 'HRD', 'EMP-001', 'Pembaruan Buku Panduan Cuti & Keseimbangan Kerja', 'Revisi kebijakan cuti tahunan dan tata cara pengajuan pengganti tugas.', 8.00, 'low', -4, 'completed'],

            // PRD (4 new)
            ['T-PRD-1', 'PRD', 'EMP-007', 'Riset Usability Alur Pencatatan Work Log Harian', 'Wawancara 12 pegawai lintas divisi untuk mengurangi hambatan pengisian log.', 16.00, 'high', 4, 'in_progress'],
            ['T-PRD-2', 'PRD', 'EMP-007', 'Perancangan Peta Jalan Produk Semester I 2027', 'Menyelaraskan prioritas fitur berdasarkan umpan balik manajer dan data risiko.', 20.00, 'high', 11, 'open'],
            ['T-PRD-3', 'PRD', 'EMP-007', 'Audit Konsistensi Komponen UI & Aksesibilitas', 'Memeriksa kontras warna, navigasi keyboard, dan responsivitas tablet.', 12.00, 'medium', 6, 'in_progress'],
            ['T-PRD-4', 'PRD', 'EMP-007', 'Pengukuran Adopsi Fitur Command Palette Ctrl K', 'Menyusun ringkasan metrik navigasi cepat oleh pengguna aktif.', 8.00, 'low', 16, 'cancelled'],

            // QA (4 new)
            ['T-QA-1', 'QA', 'EMP-008', 'Otomasi Pengujian Regresi Kalkulasi Workload Risk', 'Membangun suite pengujian penuh skenario batas jam, cuti penuh, dan override PP 35.', 24.00, 'critical', 2, 'in_progress'],
            ['T-QA-2', 'QA', 'EMP-008', 'Pengujian Beban API Dasbor untuk 100 Pengguna Simultan', 'Simulasi beban tinggi pada endpoint ringkasan manajer dan ekspor data.', 18.00, 'high', 5, 'in_progress'],
            ['T-QA-3', 'QA', 'EMP-008', 'Verifikasi Privasi NFR-02 pada Seluruh Endpoint Survei', 'Memastikan tidak ada kebocoran identitas responden ke akun manajer.', 12.00, 'critical', 3, 'in_progress'],
            ['T-QA-4', 'QA', 'EMP-008', 'Pembaruan Checklist Rilis Produksi Mingguan', 'Menambahkan pemeriksaan kompatibilitas dark mode dan format tanggal lokal.', 8.00, 'low', -2, 'completed'],

            // FIN (4 new)
            ['T-FIN-1', 'FIN', 'EMP-009', 'Tutup Buku & Rekonsiliasi Laporan Keuangan November', 'Finalisasi jurnal penyesuaian, kas operasional, dan verifikasi faktur vendor.', 20.00, 'critical', 3, 'in_progress'],
            ['T-FIN-2', 'FIN', 'EMP-009', 'Pelaporan SPT Masa PPh 21 & PPN Bulanan', 'Validasi potongan pajak karyawan dan pelaporan tepat waktu sebelum jatuh tempo.', 14.00, 'high', 5, 'in_progress'],
            ['T-FIN-3', 'FIN', 'EMP-009', 'Penyusunan Rencana Anggaran Belanja Departemen 2027', 'Konsolidasi usulan anggaran pelatihan, infrastruktur, dan operasional.', 18.00, 'medium', 14, 'open'],
            ['T-FIN-4', 'FIN', 'EMP-009', 'Audit Internal Kelengkapan Kompensasi Pegawai', 'Memverifikasi kesesuaian tunjangan dan manfaat sesuai jenjang jabatan.', 10.00, 'medium', 9, 'open'],

            // MKT (3 new)
            ['T-MKT-1', 'MKT', 'EMP-010', 'Peluncuran Kampanye Employer Branding SDG 8', 'Produksi materi publikasi budaya kerja sehat dan keberlanjutan perusahaan.', 16.00, 'high', 6, 'in_progress'],
            ['T-MKT-2', 'MKT', 'EMP-010', 'Optimasi Konversi Halaman Web & Analitik Bulanan', 'Evaluasi performa kanal organik serta pelaporan ROI kampanye digital.', 12.00, 'medium', 10, 'open'],
            ['T-MKT-3', 'MKT', 'EMP-010', 'Penyelenggaraan Webinar Praktik Kerja Layak B2B', 'Koordinasi narasumber, pendaftaran peserta, dan materi presentasi.', 14.00, 'medium', -3, 'completed'],

            // SLS (4 new)
            ['T-SLS-1', 'SLS', 'EMP-011', 'Finalisasi Proposal Kemitraan 5 Klien Korporasi', 'Penyusunan penawaran teknis dan SLA untuk kontrak tahunan Q4.', 24.00, 'critical', 2, 'in_progress'],
            ['T-SLS-2', 'SLS', 'EMP-011', 'Tinjauan Perpanjangan Kontrak Klien Strategis', 'Koordinasi evaluasi layanan dan jadwal perpanjangan 12 akun utama.', 18.00, 'high', 4, 'in_progress'],
            ['T-SLS-3', 'SLS', 'EMP-011', 'Pembaruan Pipeline CRM & Proyeksi Pendapatan', 'Pembersihan data prospek aktif dan klasifikasi peluang kuartal berjalan.', 10.00, 'medium', 8, 'open'],
            ['T-SLS-4', 'SLS', 'EMP-011', 'Pelatihan Demo Produk untuk Tim Account Executive', 'Simulasi presentasi fitur analitik beban kerja kepada calon klien.', 8.00, 'low', 15, 'open'],

            // ITX (4 new)
            ['T-ITX-1', 'ITX', 'EMP-012', 'Patching Keamanan Server Produksi & Audit Firewall', 'Pembaruan kernel keamanan dan verifikasi aturan akses jaringan internal.', 22.00, 'critical', 1, 'in_progress'],
            ['T-ITX-2', 'ITX', 'EMP-012', 'Simulasi Disaster Recovery & Uji Restore Backup', 'Menguji waktu pemulihan basis data operasional pada lingkungan staging.', 18.00, 'high', 5, 'in_progress'],
            ['T-ITX-3', 'ITX', 'EMP-012', 'Optimalisasi Pemantauan Metrik Latensi & Alerting', 'Menyesuaikan ambang batas peringatan infrastruktur agar mengurangi noise malam hari.', 14.00, 'medium', 9, 'open'],
            ['T-ITX-4', 'ITX', 'EMP-012', 'Inventarisasi Lisensi Perangkat Lunak & Perangkat Kerja', 'Audit pemakaian laptop dan lisensi aktif lintas 10 departemen.', 10.00, 'low', -5, 'completed'],

            // GAF (4 new)
            ['T-GAF-1', 'GAF', 'EMP-013', 'Inspeksi Ergonomi Workstation & Pencahayaan Kantor', 'Pemeriksaan menyeluruh kursi kerja, meja, dan intensitas cahaya lantai 1 hingga 3.', 14.00, 'high', 4, 'in_progress'],
            ['T-GAF-2', 'GAF', 'EMP-013', 'Simulasi Evakuasi Tanggap Darurat & Pemeriksaan APAR', 'Pelaksanaan latihan keselamatan berkala serta pengecekan kedaluwarsa APAR.', 12.00, 'high', 7, 'open'],
            ['T-GAF-3', 'GAF', 'EMP-013', 'Perawatan Berkala Sistem Tata Udara & Ruang Rapat', 'Pembersihan unit AC sentral dan peningkatan kualitas ventilasi ruangan.', 10.00, 'medium', 12, 'open'],
            ['T-GAF-4', 'GAF', 'EMP-013', 'Pengadaan Fasilitas Ruang Istirahat & Laktasi', 'Penataan ulang ruang istirahat pegawai untuk mendukung pemulihan kerja.', 8.00, 'low', -2, 'completed'],
        ];

        $tasks = [];
        foreach ($defs as [$key, $deptCode, $creatorCode, $title, $desc, $hours, $priority, $dueOffset, $status]) {
            $tasks[$key] = Task::firstOrCreate(
                [
                    'title' => $title,
                    'department_id' => $departments[$deptCode]->id,
                ],
                [
                    'created_by' => $employees[$creatorCode]->id,
                    'description' => $desc,
                    'estimated_hours' => $hours,
                    'priority' => $priority,
                    'due_date' => now()->addDays($dueOffset)->toDateString(),
                    'status' => $status,
                ]
            );
        }

        return $tasks;
    }

    /**
     * @param  array<string, Task>  $tasks
     * @param  array<string, Employee>  $employees
     * @param  array<string, Department>  $departments
     * @return array<string, TaskAssignment>
     */
    private function seedTaskAssignments(array $tasks, array $employees, array $departments): array
    {
        $defs = [
            // High-load / Override PP 35 employees get multiple active heavy tasks with tight deadlines
            ['T-ENG-1', 'EMP-014', 'EMP-002', 2, 'in_progress'],
            ['T-ENG-2', 'EMP-014', 'EMP-002', 4, 'in_progress'],
            ['T-ENG-3', 'EMP-014', 'EMP-002', 5, 'assigned'],

            ['T-OPS-1', 'EMP-023', 'EMP-006', 2, 'in_progress'],
            ['T-OPS-2', 'EMP-023', 'EMP-006', 4, 'in_progress'],
            ['T-OPS-5', 'EMP-023', 'EMP-006', 6, 'assigned'],

            ['T-QA-1', 'EMP-041', 'EMP-008', 2, 'in_progress'],
            ['T-QA-2', 'EMP-041', 'EMP-008', 5, 'in_progress'],
            ['T-QA-3', 'EMP-041', 'EMP-008', 3, 'assigned'],

            ['T-SLS-1', 'EMP-056', 'EMP-011', 2, 'in_progress'],
            ['T-SLS-2', 'EMP-056', 'EMP-011', 4, 'in_progress'],
            ['T-SLS-3', 'EMP-056', 'EMP-011', 6, 'assigned'],

            ['T-ITX-1', 'EMP-061', 'EMP-012', 1, 'in_progress'],
            ['T-ITX-2', 'EMP-061', 'EMP-012', 5, 'in_progress'],
            ['T-ITX-3', 'EMP-061', 'EMP-012', 7, 'assigned'],

            // ENG balanced & medium load
            ['T-ENG-1', 'EMP-015', 'EMP-002', 3, 'in_progress'],
            ['T-ENG-2', 'EMP-015', 'EMP-002', 5, 'assigned'],
            ['T-ENG-3', 'EMP-016', 'EMP-002', 5, 'in_progress'],
            ['T-ENG-4', 'EMP-017', 'EMP-002', 10, 'assigned'],
            ['T-ENG-2', 'EMP-018', 'EMP-002', 4, 'in_progress'],
            ['T-ENG-4', 'EMP-018', 'EMP-002', 8, 'assigned'],
            ['T-ENG-3', 'EMP-019', 'EMP-002', 6, 'in_progress'],
            ['T-ENG-4', 'EMP-020', 'EMP-002', 11, 'assigned'],
            ['T-ENG-6', 'EMP-021', 'EMP-002', 16, 'in_progress'],
            ['T-ENG-5', 'EMP-022', 'EMP-002', -1, 'completed'],
            ['T-ENG-6', 'EMP-022', 'EMP-002', 18, 'assigned'],

            // OPS
            ['T-OPS-1', 'EMP-024', 'EMP-006', 3, 'in_progress'],
            ['T-OPS-2', 'EMP-024', 'EMP-006', 5, 'assigned'],
            ['T-OPS-2', 'EMP-025', 'EMP-006', 5, 'in_progress'],
            ['T-OPS-3', 'EMP-026', 'EMP-006', 9, 'in_progress'],
            ['T-OPS-5', 'EMP-027', 'EMP-006', 6, 'in_progress'],
            ['T-OPS-3', 'EMP-028', 'EMP-006', 10, 'assigned'],
            ['T-OPS-4', 'EMP-029', 'EMP-006', -3, 'completed'],
            ['T-OPS-5', 'EMP-029', 'EMP-006', 12, 'assigned'],

            // HRD (note: EMP-030 is on approved 40h full-week leave -> intentionally 0 active assignments)
            ['T-HRD-1', 'EMP-031', 'EMP-001', 3, 'in_progress'],
            ['T-HRD-2', 'EMP-032', 'EMP-001', 12, 'in_progress'],
            ['T-HRD-3', 'EMP-033', 'EMP-001', 5, 'in_progress'],
            ['T-HRD-1', 'EMP-034', 'EMP-001', 4, 'in_progress'],
            ['T-HRD-4', 'EMP-030', 'EMP-001', -4, 'completed'],

            // PRD (EMP-035 has approved 16h partial leave -> 24h effective capacity)
            ['T-PRD-1', 'EMP-035', 'EMP-007', 4, 'in_progress'],
            ['T-PRD-3', 'EMP-035', 'EMP-007', 6, 'assigned'],
            ['T-PRD-2', 'EMP-036', 'EMP-007', 11, 'in_progress'],
            ['T-PRD-1', 'EMP-037', 'EMP-007', 3, 'in_progress'],
            ['T-PRD-2', 'EMP-037', 'EMP-007', 6, 'assigned'],
            ['T-PRD-3', 'EMP-038', 'EMP-007', 8, 'in_progress'],
            ['T-PRD-3', 'EMP-039', 'EMP-007', 9, 'assigned'],
            ['T-PRD-1', 'EMP-040', 'EMP-007', 12, 'assigned'],

            // QA
            ['T-QA-2', 'EMP-042', 'EMP-008', 5, 'in_progress'],
            ['T-QA-3', 'EMP-042', 'EMP-008', 4, 'assigned'],
            ['T-QA-3', 'EMP-043', 'EMP-008', 4, 'in_progress'],
            ['T-QA-1', 'EMP-044', 'EMP-008', 6, 'in_progress'],
            ['T-QA-4', 'EMP-045', 'EMP-008', -2, 'completed'],
            ['T-QA-2', 'EMP-045', 'EMP-008', 11, 'assigned'],

            // FIN
            ['T-FIN-1', 'EMP-046', 'EMP-009', 3, 'in_progress'],
            ['T-FIN-2', 'EMP-046', 'EMP-009', 5, 'assigned'],
            ['T-FIN-2', 'EMP-047', 'EMP-009', 5, 'in_progress'],
            ['T-FIN-3', 'EMP-048', 'EMP-009', 14, 'in_progress'],
            ['T-FIN-4', 'EMP-049', 'EMP-009', 9, 'assigned'],
            ['T-FIN-1', 'EMP-050', 'EMP-009', 4, 'in_progress'],

            // MKT
            ['T-MKT-1', 'EMP-051', 'EMP-010', 6, 'in_progress'],
            ['T-MKT-2', 'EMP-052', 'EMP-010', 10, 'in_progress'],
            ['T-MKT-1', 'EMP-053', 'EMP-010', 7, 'assigned'],
            ['T-MKT-2', 'EMP-054', 'EMP-010', 12, 'assigned'],
            ['T-MKT-3', 'EMP-055', 'EMP-010', -3, 'completed'],

            // SLS
            ['T-SLS-1', 'EMP-057', 'EMP-011', 3, 'in_progress'],
            ['T-SLS-2', 'EMP-057', 'EMP-011', 5, 'assigned'],
            ['T-SLS-2', 'EMP-058', 'EMP-011', 5, 'in_progress'],
            ['T-SLS-3', 'EMP-059', 'EMP-011', 9, 'in_progress'],
            ['T-SLS-4', 'EMP-060', 'EMP-011', 15, 'assigned'],

            // ITX
            ['T-ITX-1', 'EMP-062', 'EMP-012', 2, 'in_progress'],
            ['T-ITX-2', 'EMP-062', 'EMP-012', 6, 'assigned'],
            ['T-ITX-3', 'EMP-063', 'EMP-012', 9, 'in_progress'],
            ['T-ITX-4', 'EMP-063', 'EMP-012', -5, 'completed'],

            // GAF
            ['T-GAF-1', 'EMP-064', 'EMP-013', 4, 'in_progress'],
            ['T-GAF-2', 'EMP-065', 'EMP-013', 7, 'in_progress'],
            ['T-GAF-3', 'EMP-066', 'EMP-013', 12, 'assigned'],
            ['T-GAF-4', 'EMP-065', 'EMP-013', -2, 'completed'],
        ];

        $byEmployee = [];
        foreach ($defs as [$taskKey, $empCode, $assignerCode, $deadlineOffset, $status]) {
            $task = $tasks[$taskKey] ?? null;
            $emp = $employees[$empCode] ?? null;
            $assigner = $employees[$assignerCode] ?? null;
            if (! $task || ! $emp || ! $assigner) {
                continue;
            }

            $assignment = TaskAssignment::firstOrCreate(
                [
                    'task_id' => $task->id,
                    'employee_id' => $emp->id,
                ],
                [
                    'assigned_by' => $assigner->id,
                    'assigned_at' => now()->subDays(5),
                    'deadline' => now()->addDays($deadlineOffset)->toDateString(),
                    'status' => $status,
                ]
            );

            if (! isset($byEmployee[$empCode]) && $status !== 'completed') {
                $byEmployee[$empCode] = $assignment;
            }
        }

        return $byEmployee;
    }

    /**
     * Seed current-week and previous-week work logs producing realistic
     * low, medium, high, and PP No. 35/2021 override workload distributions.
     *
     * @param  array<string, Employee>  $employees
     * @param  array<string, TaskAssignment>  $primaryAssignments
     */
    private function seedWorkLogs(
        array $employees,
        array $primaryAssignments,
        CarbonInterface $currentWeekStart,
        CarbonInterface $prevWeekStart
    ): void {
        // Explicit workload profiles for realistic enterprise distribution
        $overrideHeavyHours = ['EMP-014', 'EMP-023', 'EMP-041']; // >= 56h/week (PP 35 total-hours override)
        $overrideDailyOt = ['EMP-056', 'EMP-061']; // 45h/week + approved 5h single-day overtime (> 4h/day PP 35 override)
        $highRiskCodes = ['EMP-015', 'EMP-024', 'EMP-037', 'EMP-046', 'EMP-057', 'EMP-062']; // 48-51h/week
        $mediumRiskCodes = [
            'EMP-006', 'EMP-008', 'EMP-011', 'EMP-012', 'EMP-018', 'EMP-025',
            'EMP-027', 'EMP-035', 'EMP-042', 'EMP-043', 'EMP-047', 'EMP-050',
            'EMP-051', 'EMP-058', 'EMP-063', 'EMP-064',
        ]; // 42-45h/week

        $activityTemplates = [
            'ENG' => 'Pengembangan fitur layanan inti, tinjauan kode, dan perbaikan pengujian integrasi.',
            'OPS' => 'Penanganan tiket operasional harian, monitoring SLA, dan koordinasi serah terima shift.',
            'HRD' => 'Evaluasi kepatuhan jam kerja pegawai, pengelolaan pelatihan, dan administrasi SDM.',
            'PRD' => 'Penyusunan spesifikasi produk, tinjauan desain UI/UX, dan sinkronisasi sprint.',
            'QA' => 'Eksekusi skenario pengujian regresi, pelaporan cacat, dan validasi kesiapan rilis.',
            'FIN' => 'Rekonsiliasi transaksi bulanan, verifikasi faktur operasional, dan pelaporan pajak.',
            'MKT' => 'Pelaksanaan kampanye pemasaran digital, penyusunan konten, dan analisis konversi.',
            'SLS' => 'Presentasi solusi kepada prospek B2B, penyusunan proposal, dan tindak lanjut klien.',
            'ITX' => 'Pemeliharaan infrastruktur server cloud, pemantauan keamanan, dan optimasi deployment.',
            'GAF' => 'Inspeksi fasilitas kantor, pengecekan standar K3, dan pemenuhan kebutuhan logistik.',
        ];

        foreach ($employees as $code => $employee) {
            if ($employee->status !== 'active') {
                continue;
            }
            // Skip EMP-003..EMP-005 (already seeded by WorkLogSeeder) and EMP-030 (full-week approved leave)
            if (in_array($code, ['EMP-003', 'EMP-004', 'EMP-005', 'EMP-030'], true)) {
                continue;
            }

            $deptCode = $employee->department?->code ?? 'ENG';
            $workDays = (int) ($employee->employmentType?->work_days_per_week ?? 5);
            $assignmentId = $primaryAssignments[$code]->id ?? null;
            $desc = $activityTemplates[$deptCode] ?? 'Pelaksanaan tugas operasional harian sesuai rencana kerja.';

            if (in_array($code, $overrideHeavyHours, true)) {
                // 5 days x 11.5h = 57.5h (>= 55h PP 35/2021 override)
                $dailyPattern = [11.5, 11.5, 11.5, 11.5, 11.5];
                $prevPattern = [10.0, 10.5, 10.0, 10.0, 9.5];
            } elseif (in_array($code, $overrideDailyOt, true)) {
                // 5 days total 46h, with day 2 having 13h (5h overtime -> triggers > 4h daily OT override)
                $dailyPattern = [8.5, 13.0, 8.5, 8.0, 8.0];
                $prevPattern = [8.5, 9.0, 8.5, 8.0, 8.0];
            } elseif (in_array($code, $highRiskCodes, true)) {
                $dailyPattern = $workDays >= 6 ? [8.5, 8.5, 8.0, 8.5, 8.5, 7.5] : [10.0, 10.0, 9.5, 10.0, 9.5];
                $prevPattern = $workDays >= 6 ? [7.5, 8.0, 7.5, 8.0, 7.5, 6.5] : [9.0, 9.0, 8.5, 9.0, 8.5];
            } elseif (in_array($code, $mediumRiskCodes, true)) {
                $dailyPattern = $workDays >= 6 ? [7.5, 7.5, 7.5, 7.5, 7.0, 6.5] : [8.5, 9.0, 8.5, 8.5, 8.5];
                $prevPattern = $workDays >= 6 ? [7.0, 7.0, 7.0, 7.0, 6.5, 6.0] : [8.0, 8.5, 8.0, 8.0, 8.0];
            } else {
                // Balanced / Healthy (~36-40h/week)
                $dailyPattern = $workDays >= 6 ? [6.5, 6.5, 6.5, 6.5, 6.5, 5.5] : [8.0, 7.5, 8.0, 7.5, 7.5];
                $prevPattern = $workDays >= 6 ? [6.5, 6.5, 6.5, 6.0, 6.5, 5.5] : [7.5, 8.0, 7.5, 7.5, 7.5];
            }

            foreach ($dailyPattern as $dayOffset => $hours) {
                $date = $currentWeekStart->copy()->addDays($dayOffset)->toDateString();
                WorkLog::firstOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'work_date' => $date,
                    ],
                    [
                        'task_assignment_id' => $assignmentId,
                        'hours_spent' => $hours,
                        'activity_description' => $desc,
                    ]
                );
            }

            // Previous week logs (Mon, Wed, Fri summary so trends & history are rich without bloat)
            foreach ([0, 2, 4] as $dayOffset) {
                $date = $prevWeekStart->copy()->addDays($dayOffset)->toDateString();
                $hours = $prevPattern[$dayOffset] ?? 8.0;
                WorkLog::firstOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'work_date' => $date,
                    ],
                    [
                        'task_assignment_id' => $assignmentId,
                        'hours_spent' => $hours,
                        'activity_description' => 'Rekap aktivitas minggu sebelumnya: '.$desc,
                    ]
                );
            }
        }
    }

    /**
     * Seed approved/pending overtimes and leave requests (including full-week 40h leave
     * and daily > 4h PP No. 35/2021 override trigger).
     *
     * @param  array<string, Employee>  $employees
     * @param  array<string, Department>  $departments
     */
    private function seedOvertimesAndLeaves(
        array $employees,
        array $departments,
        CarbonInterface $currentWeekStart
    ): void {
        $overtimes = [
            // Daily OT > 4h (triggers PP 35/2021 override on EMP-056 & EMP-061)
            ['EMP-056', 'EMP-011', 1, 5.00, 'Finalisasi penawaran darurat klien korporasi sebelum batas pengajuan tender.', 'approved'],
            ['EMP-061', 'EMP-012', 1, 5.00, 'Patching kerentanan kritis server produksi di luar jam operasional utama.', 'approved'],
            // Multi-day OT for heavy employees
            ['EMP-014', 'EMP-002', 0, 3.50, 'Migrasi antrean notifikasi dan pemantauan kestabilan produksi.', 'approved'],
            ['EMP-014', 'EMP-002', 1, 3.50, 'Penyelesaian bottleneck kueri laporan manajemen kuartal IV.', 'approved'],
            ['EMP-014', 'EMP-002', 2, 3.50, 'Sinkronisasi rilis lintas tim engineering dan QA.', 'approved'],
            ['EMP-023', 'EMP-006', 0, 3.50, 'Koordinasi lonjakan tiket pelanggan pasca pembaruan layanan.', 'approved'],
            ['EMP-023', 'EMP-006', 2, 3.50, 'Penyesuaian jadwal shift dan audit SLA harian.', 'approved'],
            ['EMP-041', 'EMP-008', 1, 3.50, 'Otomasi pengujian regresi kritis sebelum rilis.', 'approved'],
            ['EMP-041', 'EMP-008', 3, 3.50, 'Validasi akhir keamanan endpoint dan privasi NFR-02.', 'approved'],
            // Moderate / Pending / Rejected
            ['EMP-015', 'EMP-002', 2, 2.00, 'Tinjauan pull request modul agregasi.', 'approved'],
            ['EMP-046', 'EMP-009', 2, 2.50, 'Rekonsiliasi jurnal penutup akhir bulan.', 'pending'],
            ['EMP-051', 'EMP-010', 3, 2.00, 'Revisi aset kampanye digital.', 'rejected'],
        ];

        foreach ($overtimes as [$empCode, $approverCode, $dayOffset, $hours, $reason, $status]) {
            if (! isset($employees[$empCode], $employees[$approverCode])) {
                continue;
            }
            Overtime::firstOrCreate(
                [
                    'employee_id' => $employees[$empCode]->id,
                    'overtime_date' => $currentWeekStart->copy()->addDays($dayOffset)->toDateString(),
                ],
                [
                    'duration_hours' => $hours,
                    'reason' => $reason,
                    'status' => $status,
                    'approved_by' => $status === 'pending' ? null : $employees[$approverCode]->id,
                ]
            );
        }

        $leaves = [
            // Full-week approved leave (40h -> tests division-by-zero effective capacity protection)
            ['EMP-030', 'EMP-001', 'Cuti Tahunan', 0, 4, 40.00, 'Cuti tahunan terjadwal bersama keluarga.', 'approved'],
            // Partial approved leaves (reduces weekly effective capacity cleanly)
            ['EMP-035', 'EMP-007', 'Cuti Tahunan', 2, 3, 16.00, 'Keperluan keluarga di luar kota selama dua hari.', 'approved'],
            ['EMP-016', 'EMP-002', 'Cuti Sakit', 3, 3, 8.00, 'Pemulihan kesehatan dengan surat keterangan dokter.', 'approved'],
            ['EMP-048', 'EMP-009', 'Cuti Tahunan', 4, 4, 8.00, 'Cuti istirahat akhir pekan panjang.', 'approved'],
            ['EMP-052', 'EMP-010', 'Cuti Tahunan', 7, 8, 16.00, 'Pengajuan cuti tahunan minggu depan.', 'pending'],
            ['EMP-026', 'EMP-006', 'Cuti Izin Khusus', 9, 9, 8.00, 'Menghadiri upacara wisuda keluarga.', 'pending'],
            ['EMP-059', 'EMP-011', 'Cuti Tahunan', 1, 2, 16.00, 'Permohonan cuti berbenturan jadwal presentasi klien.', 'rejected'],
        ];

        foreach ($leaves as [$empCode, $approverCode, $type, $startOffset, $endOffset, $hours, $reason, $status]) {
            if (! isset($employees[$empCode], $employees[$approverCode])) {
                continue;
            }
            LeaveRequest::firstOrCreate(
                [
                    'employee_id' => $employees[$empCode]->id,
                    'start_date' => $currentWeekStart->copy()->addDays($startOffset)->toDateString(),
                ],
                [
                    'leave_type' => $type,
                    'end_date' => $currentWeekStart->copy()->addDays($endOffset)->toDateString(),
                    'total_hours' => $hours,
                    'reason' => $reason,
                    'status' => $status,
                    'approved_by' => $status === 'pending' ? null : $employees[$approverCode]->id,
                ]
            );
        }
    }

    /**
     * @return array<int, Training>
     */
    private function seedTrainings(): array
    {
        $extraTrainings = [
            [
                'title' => 'Keamanan Siber Cloud & Praktik DevSecOps Modern',
                'category' => 'Teknis & Rekayasa',
                'provider' => 'CyberGuard Nusantara',
                'duration_hours' => 16.00,
                'start_date' => now()->subDays(28)->toDateString(),
                'end_date' => now()->subDays(26)->toDateString(),
            ],
            [
                'title' => 'Lean Operations & Manajemen Kapasitas Layanan',
                'category' => 'Operasional & Layanan',
                'provider' => 'Akademi Manajemen Operasional',
                'duration_hours' => 12.00,
                'start_date' => now()->subDays(20)->toDateString(),
                'end_date' => now()->subDays(19)->toDateString(),
            ],
            [
                'title' => 'Kepatuhan Akuntansi PSAK & Perpajakan Korporasi 2026',
                'category' => 'Keuangan & Kepatuhan',
                'provider' => 'Ikatan Akuntan Profesional',
                'duration_hours' => 10.00,
                'start_date' => now()->subDays(10)->toDateString(),
                'end_date' => now()->subDays(9)->toDateString(),
            ],
            [
                'title' => 'Agile Product Discovery & Riset Pengguna Berkelanjutan',
                'category' => 'Produk & Desain',
                'provider' => 'Product Guild Indonesia',
                'duration_hours' => 12.00,
                'start_date' => now()->subDays(1)->toDateString(),
                'end_date' => now()->addDays(2)->toDateString(),
            ],
            [
                'title' => 'Ergonomi Ruang Kerja & Pencegahan Kelelahan Kerja (K3)',
                'category' => 'Keselamatan & K3',
                'provider' => 'Balai K3 Nasional',
                'duration_hours' => 8.00,
                'start_date' => now()->addDays(5)->toDateString(),
                'end_date' => now()->addDays(6)->toDateString(),
            ],
            [
                'title' => 'Negosiasi B2B Etis & Pengelolaan Kemitraan Jangka Panjang',
                'category' => 'Penjualan & Pemasaran',
                'provider' => 'Komunitas Bisnis Nusantara',
                'duration_hours' => 8.00,
                'start_date' => now()->addDays(12)->toDateString(),
                'end_date' => now()->addDays(13)->toDateString(),
            ],
        ];

        foreach ($extraTrainings as $item) {
            Training::firstOrCreate(
                ['title' => $item['title']],
                $item
            );
        }

        return Training::query()->orderBy('id')->get()->all();
    }

    /**
     * @param  array<int, Training>  $trainings
     * @param  array<string, Employee>  $employees
     */
    private function seedTrainingParticipations(array $trainings, array $employees): void
    {
        if (count($trainings) === 0) {
            return;
        }

        $activeEmployees = array_values(array_filter(
            $employees,
            fn (Employee $emp) => $emp->status === 'active'
        ));

        foreach ($activeEmployees as $idx => $employee) {
            // Skip baseline EMP-003..EMP-005 primary entries to stay neat (still add 1 extra completed if applicable)
            $primaryTraining = $trainings[$idx % count($trainings)];
            $secondaryTraining = $trainings[($idx + 3) % count($trainings)];

            $primaryEnded = $primaryTraining->end_date && $primaryTraining->end_date->isPast();
            $primaryStatus = $primaryEnded ? ($idx % 11 === 0 ? 'dropped' : 'completed') : 'enrolled';

            TrainingParticipation::firstOrCreate(
                [
                    'training_id' => $primaryTraining->id,
                    'employee_id' => $employee->id,
                ],
                [
                    'status' => $primaryStatus,
                    'completion_date' => $primaryStatus === 'completed'
                        ? $primaryTraining->end_date->toDateString()
                        : null,
                ]
            );

            if ($idx % 2 === 0 && $secondaryTraining->id !== $primaryTraining->id) {
                $secEnded = $secondaryTraining->end_date && $secondaryTraining->end_date->isPast();
                $secStatus = $secEnded ? 'completed' : 'enrolled';

                TrainingParticipation::firstOrCreate(
                    [
                        'training_id' => $secondaryTraining->id,
                        'employee_id' => $employee->id,
                    ],
                    [
                        'status' => $secStatus,
                        'completion_date' => $secStatus === 'completed'
                            ? $secondaryTraining->end_date->toDateString()
                            : null,
                    ]
                );
            }
        }
    }

    /**
     * Seed 4 monthly surveys and ~180 responses across all 10 departments
     * (all manager/admin views strictly aggregate per NFR-02).
     *
     * @param  array<string, Employee>  $employees
     */
    private function seedSurveysAndResponses(
        array $employees,
        string $currentPeriodMonth,
        string $prevPeriodMonth
    ): void {
        $twoMonthsAgo = now()->copy()->subMonthsNoOverflow(2)->format('Y-m');
        $threeMonthsAgo = now()->copy()->subMonthsNoOverflow(3)->format('Y-m');

        $surveys = [
            WorkSurvey::firstOrCreate(
                ['period_month' => $threeMonthsAgo, 'title' => 'Survei Budaya Kerja & Kesejahteraan Triwulan III'],
                [
                    'description' => 'Evaluasi menyeluruh persepsi beban kerja, dukungan tim, dan kenyamanan lingkungan kerja.',
                    'is_active' => false,
                ]
            ),
            WorkSurvey::firstOrCreate(
                ['period_month' => $twoMonthsAgo, 'title' => 'Survei Keseimbangan Kerja & Ergonomi Bulanan'],
                [
                    'description' => 'Pemantauan bulanan keseimbangan kerja-hidup serta efektivitas fasilitas kerja.',
                    'is_active' => false,
                ]
            ),
            WorkSurvey::firstOrCreate(
                ['period_month' => $prevPeriodMonth],
                [
                    'title' => 'Survei Kesejahteraan & Beban Kerja Periode Sebelumnya',
                    'description' => 'Evaluasi bulanan keseimbangan kehidupan-kerja dan persepsi beban kerja tim.',
                    'is_active' => false,
                ]
            ),
            WorkSurvey::firstOrCreate(
                ['period_month' => $currentPeriodMonth],
                [
                    'title' => 'Survei Kondisi Kerja Bulan Berjalan',
                    'description' => 'Penilaian rutin keseimbangan kerja-hidup serta kenyamanan beban kerja bulan berjalan.',
                    'is_active' => true,
                ]
            ),
        ];

        // Department-specific realistic score profiles [wlbBase, workloadBase]
        $deptProfiles = [
            'ENG' => [4, 3],
            'OPS' => [3, 4],
            'HRD' => [5, 2],
            'PRD' => [4, 3],
            'QA' => [3, 4],
            'FIN' => [4, 3],
            'MKT' => [4, 3],
            'SLS' => [3, 4],
            'ITX' => [3, 4],
            'GAF' => [5, 2],
        ];

        $sampleComments = [
            'Distribusi prioritas mingguan semakin jelas berkat sinkronisasi rutin.',
            'Perlu jeda koordinasi lebih baik saat mendekati tenggat rilis besar.',
            'Lingkungan kerja nyaman dan komunikasi lintas divisi cukup suportif.',
            'Jadwal kerja sudah sesuai batas sehat, sangat membantu fokus harian.',
            'Beberapa minggu terakhir lonjakan tiket operasional perlu tambahan dukungan.',
        ];

        $activeEmployees = array_values(array_filter(
            $employees,
            fn (Employee $emp) => $emp->status === 'active'
        ));

        foreach ($surveys as $sIdx => $survey) {
            foreach ($activeEmployees as $eIdx => $employee) {
                // Leave ~25% of employees pending on current active survey (including EMP-003 so demo employee can fill it!)
                if ($survey->is_active && ($employee->employee_code === 'EMP-003' || $eIdx % 4 === 0)) {
                    continue;
                }
                if (! $survey->is_active && $eIdx % 5 === 0) {
                    continue;
                }

                $deptCode = $employee->department?->code ?? 'ENG';
                [$wlbBase, $wlBase] = $deptProfiles[$deptCode] ?? [4, 3];
                $jitter = (($eIdx + $sIdx) % 3) - 1; // -1, 0, +1
                $wlb = max(1, min(5, $wlbBase + ($jitter === -1 && $wlbBase > 2 ? -1 : 0)));
                $wl = max(1, min(5, $wlBase + ($jitter === 1 && $wlBase < 5 ? 1 : 0)));

                SurveyResponse::firstOrCreate(
                    [
                        'work_survey_id' => $survey->id,
                        'employee_id' => $employee->id,
                    ],
                    [
                        'work_life_balance_score' => $wlb,
                        'workload_perception_score' => $wl,
                        'comments' => $sampleComments[($eIdx + $sIdx) % count($sampleComments)],
                        'submitted_at' => now()->subDays(max(1, (3 - $sIdx) * 25 + ($eIdx % 6))),
                    ]
                );
            }
        }
    }

    /**
     * @param  array<string, Employee>  $employees
     * @param  array<string, Department>  $departments
     */
    private function seedWorkplaceIssuesAndSafety(array $employees, array $departments): void
    {
        $issues = [
            ['EMP-014', 'ENG', 'Beban Kerja', 'Penumpukan tenggat migrasi antrean bersamaan dengan dukungan insiden produksi memicu lembur beruntun.', 'open', null, null],
            ['EMP-016', 'ENG', 'Komunikasi Tim', 'Perubahan spesifikasi desain mendadak di tengah sprint memerlukan kanal persetujuan yang lebih jelas.', 'in_progress', 'Manajer produk dan engineering menyepakati batas beku spesifikasi H-2 sebelum sprint.', null],
            ['EMP-023', 'OPS', 'Jadwal & Lembur', 'Lonjakan volume tiket akhir bulan sering melampaui kapasitas tim shift malam.', 'open', null, null],
            ['EMP-025', 'OPS', 'Fasilitas & Ergonomi', 'Headset peredam bising di ruang layanan pelanggan perlu penggantian bantalan telinga.', 'resolved', 'Tim GAF telah mendistribusikan 10 unit headset ergonomis baru untuk ruang layanan.', 3],
            ['EMP-031', 'HRD', 'Komunikasi Tim', 'Informasi jadwal pelatihan wajib belum seluruhnya tersinkronisasi dengan kalender tim lapangan.', 'resolved', 'Pengingat jadwal pelatihan kini dikirim otomatis minimal H-7 ke masing-masing manajer.', 6],
            ['EMP-035', 'PRD', 'Beban Kerja', 'Permintaan revisi mendadak dari tiga lini bisnis secara bersamaan memadatkan kapasitas desain.', 'in_progress', 'Diterapkan antrean prioritas mingguan bersama Product Manager setiap Senin pagi.', null],
            ['EMP-041', 'QA', 'Beban Kerja', 'Pengujian regresi manual masih memakan waktu panjang menjelang jadwal rilis Jumat sore.', 'open', null, null],
            ['EMP-043', 'QA', 'Fasilitas & Ergonomi', 'Perangkat uji mobile di laboratorium QA membutuhkan tambahan docking station dan monitor eksternal.', 'resolved', 'Pengadaan 4 monitor eksternal dan docking station selesai dipasang.', 8],
            ['EMP-046', 'FIN', 'Jadwal & Lembur', 'Keterlambatan pengumpulan bukti transaksi divisi lain membuat proses tutup buku menumpuk di akhir bulan.', 'in_progress', 'Kebijakan batas akhir unggah dokumen keuangan H-3 akhir bulan mulai disosialisasikan.', null],
            ['EMP-051', 'MKT', 'Kesehatan Mental', 'Ritme peluncuran kampanye berturut-turut membutuhkan waktu jeda retrospektif yang lebih terstruktur.', 'resolved', 'Tim pemasaran menetapkan blok fokus tanpa rapat setiap Rabu pagi.', 5],
            ['EMP-056', 'SLS', 'Beban Kerja', 'Target presentasi lima proposal korporasi dalam satu minggu memicu lembur harian di atas 4 jam.', 'open', null, null],
            ['EMP-061', 'ITX', 'Jadwal & Lembur', 'Jendela pemeliharaan server tengah malam perlu kompensasi waktu istirahat pengganti pada hari kerja berikutnya.', 'in_progress', 'HRD dan Manajer ITX sedang menyusun mekanisme time-off pengganti untuk jadwal pemeliharaan malam.', null],
            ['EMP-064', 'GAF', 'Keselamatan & K3', 'Jalur akses tangga darurat lantai dua perlu pengecatan ulang marka anti-slip.', 'resolved', 'Pengecatan ulang marka jalur evakuasi dan pita anti-slip selesai dilaksanakan.', 2],
            ['EMP-066', 'GAF', 'Fasilitas & Ergonomi', 'Suhu pendingin ruangan di area kerja sayap barat cenderung terlalu dingin pada pagi hari.', 'open', null, null],
        ];

        foreach ($issues as [$empCode, $deptCode, $category, $description, $status, $notes, $resolvedDaysAgo]) {
            if (! isset($employees[$empCode], $departments[$deptCode])) {
                continue;
            }
            WorkplaceIssue::firstOrCreate(
                [
                    'reported_by' => $employees[$empCode]->id,
                    'category' => $category,
                    'description' => $description,
                ],
                [
                    'department_id' => $departments[$deptCode]->id,
                    'status' => $status,
                    'resolution_notes' => $notes,
                    'resolved_at' => $resolvedDaysAgo !== null ? now()->subDays($resolvedDaysAgo) : null,
                ]
            );
        }

        $incidents = [
            ['EMP-064', 'GAF', 18, 'Tangga Darurat Lantai 2', 'minor', 'Lantai sedikit licin pasca pembersihan pagi; tidak ada cedera, langsung dipasang tanda peringatan.', 'resolved'],
            ['EMP-024', 'OPS', 12, 'Ruang Operasional Shift B', 'minor', 'Kabel daya monitor longgar dan menimbulkan percikan kecil saat colokan dicabut.', 'resolved'],
            ['EMP-062', 'ITX', 8, 'Ruang Server Utama', 'moderate', 'Sensor suhu rak server meningkat melewati ambang batas akibat gangguan kipas pendingin cadangan.', 'resolved'],
            ['EMP-066', 'GAF', 4, 'Area Parkir Basement', 'minor', 'Penerangan jalur pejalan kaki menuju lift padam pada satu titik lampu.', 'investigating'],
            ['EMP-027', 'OPS', 2, 'Ruang Gudang Logistik Ringan', 'moderate', 'Rak penyimpanan berkas arsip terlalu penuh dan memerlukan penataan ulang sesuai standar K3.', 'reported'],
        ];

        foreach ($incidents as [$empCode, $deptCode, $daysAgo, $location, $severity, $description, $status]) {
            if (! isset($employees[$empCode], $departments[$deptCode])) {
                continue;
            }
            SafetyIncident::firstOrCreate(
                [
                    'reported_by' => $employees[$empCode]->id,
                    'location' => $location,
                    'description' => $description,
                ],
                [
                    'department_id' => $departments[$deptCode]->id,
                    'incident_date' => now()->subDays($daysAgo)->toDateString(),
                    'severity' => $severity,
                    'status' => $status,
                ]
            );
        }
    }

    /**
     * @param  array<string, Employee>  $employees
     */
    private function seedCompensations(
        array $employees,
        string $currentPeriodMonth,
        string $prevPeriodMonth
    ): void {
        $salaryByLevel = [
            'Manager' => [24000000, 4500000, 2500000],
            'Administrator' => [14500000, 2500000, 1800000],
            'Lead' => [18500000, 3200000, 2000000],
            'Senior' => [16500000, 2800000, 1800000],
            'Staff' => [11000000, 1800000, 1500000],
            'Intern' => [4800000, 600000, 500000],
        ];

        foreach ($employees as $code => $employee) {
            if ($employee->status !== 'active') {
                continue;
            }
            $level = $employee->position?->level ?? 'Staff';
            [$base, $allow, $benefit] = $salaryByLevel[$level] ?? [10500000, 1500000, 1200000];
            $incompleteCurrent = in_array($code, ['EMP-029', 'EMP-055'], true);

            foreach ([$prevPeriodMonth, $currentPeriodMonth] as $month) {
                $isComplete = ! ($month === $currentPeriodMonth && $incompleteCurrent);
                Compensation::firstOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'period_month' => $month,
                    ],
                    [
                        'base_salary' => $base,
                        'allowances' => $allow,
                        'benefits' => $isComplete ? $benefit : 0,
                        'is_complete' => $isComplete,
                    ]
                );
            }
        }
    }

    /**
     * @param  array<string, Employee>  $employees
     */
    private function seedCompetencies(array $employees): void
    {
        $defs = [
            ['Manajemen Beban & Prioritas Kerja', 'Kepemimpinan', 'Kemampuan merencanakan kapasitas tugas dan menjaga ritme kerja berkelanjutan.'],
            ['Rekayasa & Arsitektur Sistem', 'Teknis', 'Perancangan aplikasi yang andal, aman, dan mudah dirawat.'],
            ['Keunggulan Operasional & SLA', 'Operasional', 'Pengelolaan layanan pelanggan dan stabilitas proses harian.'],
            ['Keselamatan & Kesehatan Kerja (K3)', 'Kepatuhan', 'Penerapan ergonomi, pencegahan risiko kerja, dan respons tanggap darurat.'],
            ['Analisis Data & Pengambilan Keputusan', 'Analitik', 'Pengolahan metrik kinerja berbasis bukti secara objektif dan non-punitif.'],
            ['Kolaborasi Lintas Departemen', 'Komunikasi', 'Koordinasi efektif antar tim untuk mencegah penumpukan pekerjaan.'],
        ];

        $competencies = [];
        foreach ($defs as [$name, $category, $desc]) {
            $competencies[] = Competency::firstOrCreate(
                ['name' => $name],
                ['category' => $category, 'description' => $desc]
            );
        }

        $activeEmployees = array_values(array_filter(
            $employees,
            fn (Employee $emp) => $emp->status === 'active'
        ));

        foreach ($activeEmployees as $idx => $employee) {
            $comp1 = $competencies[$idx % count($competencies)];
            $comp2 = $competencies[($idx + 2) % count($competencies)];

            foreach ([$comp1, $comp2] as $offset => $comp) {
                $target = 4;
                $current = (($idx + $offset) % 3 === 0) ? 4 : 3;

                EmployeeCompetency::firstOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'competency_id' => $comp->id,
                    ],
                    [
                        'current_level' => $current,
                        'target_level' => $target,
                        'last_assessed_at' => now()->subDays(15 + ($idx % 20)),
                    ]
                );
            }
        }
    }
}
