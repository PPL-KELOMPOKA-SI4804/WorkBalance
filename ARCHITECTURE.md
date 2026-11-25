# System Architecture Blueprint (ARCHITECTURE.md): WorkBalance

**Versi Dokumen:** 1.1
**Tanggal:** 25 November 2026
**Referensi Produk:** `PRD.md` (WorkBalance: SDG 8 Decision Support System)

---

## 1. Arsitektur Sistem & Tech Stack

WorkBalance dibangun menggunakan arsitektur **decoupled Client-Server (SPA + RESTful API)** yang dioptimalkan untuk lingkungan pengembangan lokal (_local development environment_).

### 1.1 Teknologi Utama

- **Frontend:** React (SPA) dengan struktur komponen modular.
- **Styling & UI System:** Tailwind CSS (detail visual dan komponen diatur terpisah pada `DESIGN.md`).
- **Data Visualization:** Recharts (untuk grafik tren garis, _stacked/grouped bar chart_, dan _donut/radial gauge_ indikator risiko).
- **Backend API:** Laravel (RESTful JSON API, _business logic engine_ untuk kalkulasi _Workload Risk_ & _Decent Work Score_, serta pemrosesan laporan periodik).
- **Database:** MySQL (relasional, 24 entitas dengan penegakan integritas _Foreign Key_).
- **Authentication & Authorization:** Custom RFC 7519 **JWT HS256 Guard (`auth:jwt`)** dengan Access Token (60 menit), Refresh Token rotasi sekali pakai (`/api/v1/auth/refresh`), Blacklist `jti` (`jwt_revoked_tokens`), dan _Role-Based Access Control_ (`employee`, `manager`, `admin`).
- **Version Control:** Git.

### 1.2 Arsitektur 3 Lapisan (ArchiMate Alignment)

1. **Business Layer:** Aktor `Pegawai`, `Manager`, dan `Admin` berinteraksi dengan _WorkBalance Service_ untuk menjalankan siklus pemantauan kondisi kerja (pencatatan aktivitas, evaluasi risiko, dan tindak lanjut perbaikan).
2. **Application Layer:**
   - _Web UI (React):_ Antarmuka interaktif berbasis peran.
   - _Backend API (Laravel):_ Gerbang pemrosesan logika bisnis dan validasi input.
   - _Authentication & RBAC Module:_ Verifikasi identitas dan pembatasan akses rute/sumber daya.
   - _Analytics Engine:_ Layanan kalkulasi `WorkloadRiskService`, `DecentWorkScoreService`, dan `RecommendationEngine`.
3. **Technology Layer:** _Local Development Environment_ yang menjalankan server aplikasi web, _Database Service_, dan _MySQL Database_.

### 1.3 Struktur Direktori Monorepo / Proyek

```text
workbalance/
├── backend/                     # Laravel REST API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/
│   │   │   └── Middleware/      # RoleMiddleware (RBAC) & SurveyPrivacyGuard
│   │   ├── Models/              # 24 Eloquent Models
│   │   └── Services/
│   │       ├── WorkloadRiskService.php      # Interpolasi linear & override PP 35/2021
│   │       ├── DecentWorkScoreService.php   # Agregasi 6 dimensi departemen
│   │       ├── RecommendationEngine.php     # Rule-based threshold trigger
│   │       └── ReportGeneratorService.php   # Penyusunan laporan periodik
│   ├── database/
│   │   ├── migrations/          # Skema 24 tabel & constraint relasional
│   │   └── seeders/             # Data uji sintetis (dummy data)
│   └── routes/api.php           # Prefix /api/v1/*
└── frontend/                    # React + Tailwind CSS
    ├── public/assets/           # workbalance_logo.svg, workbalance_horizontal_logo.svg
    └── src/
        ├── components/          # UI Primitives, Recharts Wrappers, App Shell
        ├── context/             # AuthContext & RoleRouteGuard
        ├── pages/
        │   ├── employee/        # Dashboard pribadi, WorkLog, Cuti/Lembur, Survei, K3, Kompetensi
        │   ├── manager/         # Executive Dashboard, Workload Risk, Decent Work, Rekomendasi, Laporan
        │   └── admin/           # Master Data (Pegawai, Dept, Posisi), Konfigurasi Bobot Model
        └── services/            # Axios API client (/api/v1)
```

---

## 2. Rancangan Basis Data (24 Entitas Relasional)

Basis data MySQL dikelompokkan ke dalam 5 domain fungsional dengan integritas referensial ketat (_restrict delete_ pada data master yang aktif direferensikan):

### Domain A: Pengguna & Struktur Organisasi (5 Entitas)

1. `user_accounts`: `id`, `email`, `password_hash`, `role` (`admin`, `manager`, `employee`), `is_active`, `remember_token`, `timestamps`.
2. `departments`: `id`, `name`, `code`, `description`, `manager_id` (FK -> `employees.id`, nullable), `timestamps`.
3. `positions`: `id`, `title`, `level`, `description`, `timestamps`.
4. `employment_types`: `id`, `name` (Tetap, Kontrak, Magang, Operasional Shift 6 Hari), `work_days_per_week` (`5` atau `6`, menentukan ambang lembur harian 8 jam vs 7 jam), `normal_weekly_hours` (default `40`), `timestamps`.
5. `employees`: `id`, `user_account_id` (FK), `department_id` (FK), `position_id` (FK), `employment_type_id` (FK), `employee_code`, `full_name`, `join_date`, `status` (`active`, `inactive`), `timestamps`.

### Domain B: Tugas & Aktivitas Kerja (6 Entitas)

6. `tasks`: `id`, `department_id` (FK), `created_by` (FK), `title`, `description`, `estimated_hours`, `priority` (`low`, `medium`, `high`, `critical`), `due_date`, `status` (`open`, `in_progress`, `completed`, `cancelled`), `timestamps`.
7. `task_assignments`: `id`, `task_id` (FK), `employee_id` (FK), `assigned_by` (FK), `assigned_at`, `deadline`, `status` (`assigned`, `in_progress`, `completed`), `timestamps`.
8. `work_logs`: `id`, `employee_id` (FK), `task_assignment_id` (FK, nullable), `work_date`, `hours_spent`, `activity_description`, `timestamps`.
9. `overtimes`: `id`, `employee_id` (FK), `overtime_date`, `duration_hours`, `reason`, `status` (`pending`, `approved`, `rejected`), `approved_by` (FK, nullable), `timestamps`.
10. `leave_requests`: `id`, `employee_id` (FK), `leave_type`, `start_date`, `end_date`, `total_hours`, `reason`, `status` (`pending`, `approved`, `rejected`), `approved_by` (FK, nullable), `timestamps`.
11. `compensations`: `id`, `employee_id` (FK), `period_month` (`YYYY-MM`), `base_salary`, `allowances`, `benefits`, `is_complete` (boolean untuk dimensi _Decent Work Score_), `timestamps`.

### Domain C: Kesejahteraan, Suara Pekerja & K3 (4 Entitas)

12. `work_surveys`: `id`, `title`, `period_month` (`YYYY-MM`), `description`, `is_active`, `timestamps`.
13. `survey_responses`: `id`, `work_survey_id` (FK), `employee_id` (FK), `work_life_balance_score` (int `1–5`), `workload_perception_score` (int `1–5`), `comments`, `submitted_at`, `timestamps`.
14. `workplace_issues`: `id`, `reported_by` (FK), `department_id` (FK), `category`, `description`, `status` (`open`, `in_progress`, `resolved`), `resolution_notes`, `resolved_at`, `timestamps`.
15. `safety_incidents`: `id`, `reported_by` (FK), `department_id` (FK), `incident_date`, `location`, `severity` (`minor`, `moderate`, `severe`), `description`, `status` (`reported`, `investigating`, `resolved`), `timestamps`.

### Domain D: Pelatihan & Kompetensi (4 Entitas)

16. `trainings`: `id`, `title`, `category`, `provider`, `duration_hours`, `start_date`, `end_date`, `timestamps`.
17. `training_participations`: `id`, `training_id` (FK), `employee_id` (FK), `status` (`enrolled`, `completed`, `dropped`), `completion_date`, `timestamps`.
18. `competencies`: `id`, `name`, `category`, `description`, `timestamps`.
19. `employee_competencies`: `id`, `employee_id` (FK), `competency_id` (FK), `current_level` (int `1–5`), `target_level` (int `1–5`), `last_assessed_at`, `timestamps`.

### Domain E: Analitik, Rekomendasi & Jejak Audit Tindak Lanjut (5 Entitas)

20. `workload_risks`: `id`, `employee_id` (FK), `period_week` (`YYYY-Www`), `period_month` (`YYYY-MM`), `weekly_hours_score`, `overtime_score`, `task_load_score`, `deadline_pressure_score`, `final_score`, `risk_category` (`low`, `medium`, `high`), `is_overridden` (boolean PP 35/2021), `timestamps`.
21. `decent_work_scores`: `id`, `department_id` (FK), `period_month` (`YYYY-MM`), `dim_workload_score`, `dim_wlb_score`, `dim_compensation_score`, `dim_safety_score`, `dim_voice_score`, `dim_competency_score`, `final_score`, `status_category` (`good`, `needs_attention`, `action_priority`), `timestamps`.
22. `recommendations`: `id`, `target_type` (`employee`, `department`), `target_id`, `period`, `trigger_source`, `title`, `suggested_action`, `priority`, `is_adopted`, `timestamps`.
23. `improvement_actions`: `id`, `recommendation_id` (FK, nullable), `department_id` (FK), `pic_employee_id` (FK), `title`, `action_plan`, `due_date`, `status` (`planned`, `in_progress`, `completed`, `cancelled`), `timestamps`.
24. `action_updates`: `id`, `improvement_action_id` (FK), `updated_by` (FK), `previous_status`, `new_status`, `notes`, `created_at` (Jejak audit NFR-08).

---

## 3. Spesifikasi Kontrak REST API (`/api/v1`)

Seluruh respons menggunakan format JSON standar:

```json
{
  "status": "success | error",
  "message": "Deskripsi singkat hasil operasi",
  "data": {}
}
```

### 3.1 Daftar Endpoint Utama

| Modul          | PBI      | HTTP & Endpoint                                          | Akses Peran                 | Deskripsi                                        |
| :------------- | :------- | :------------------------------------------------------- | :-------------------------- | :----------------------------------------------- |
| **Auth**       | AUTH-01  | `POST /api/v1/auth/register`                             | Admin / Public              | Mendaftarkan akun pengguna baru & terbitkan pasangan JWT |
| **Auth**       | AUTH-02  | `POST /api/v1/auth/login`                                | Public                      | Verifikasi kredensial & terbitkan Access + Refresh JWT   |
| **Auth**       | AUTH-02B | `POST /api/v1/auth/refresh`                              | Public (Refresh JWT)        | Rotasi Refresh Token sekali pakai & terbitkan pasangan baru |
| **Auth**       | AUTH-03  | `GET /api/v1/auth/me`                                    | All Authenticated           | Ambil profil sesi aktif & hak akses RBAC                 |
| **Auth**       | AUTH-04  | `DELETE /api/v1/auth/logout`                             | All Authenticated           | Akhiri sesi & catat `jti` Access + Refresh ke blacklist  |
| **Master**     | PBI-01   | `GET, POST, PUT, DELETE /api/v1/employees`               | Admin (Read: Manager)       | CRUD data master pegawai & jenis kepegawaian     |
| **Master**     | PBI-02   | `GET, POST, PUT, DELETE /api/v1/departments`             | Admin (Read: Manager)       | CRUD struktur departemen organisasi              |
| **Master**     | PBI-12   | `GET, POST, PUT, DELETE /api/v1/positions`               | Admin (Read: Manager)       | CRUD jabatan/posisi pegawai                      |
| **Tasks**      | PBI-03   | `GET, POST, PUT, DELETE /api/v1/tasks`                   | Manager (Read: Employee)    | CRUD tugas, estimasi jam, prioritas & tenggat    |
| **Tasks**      | PBI-04   | `GET, POST, PUT, DELETE /api/v1/task-assignments`        | Manager (Read: Employee)    | Penetapan & distribusi tugas ke pegawai          |
| **WorkLog**    | PBI-09   | `GET, POST, PUT, DELETE /api/v1/work-logs`               | Employee (Read: Manager)    | Pencatatan jam kerja aktual & aktivitas harian   |
| **TimeOff**    | FR-09/10 | `GET, POST, PUT /api/v1/overtimes` & `/leave-requests`   | Employee (Approve: Manager) | Pengajuan & persetujuan lembur/cuti              |
| **Wellbeing**  | PBI-07   | `GET, POST, PUT, DELETE /api/v1/surveys`                 | Admin, Manager, Employee    | Pembuatan kuesioner & pengiriman respons survei  |
| **Issues**     | PBI-08   | `GET, POST, PUT, DELETE /api/v1/workplace-issues`        | Employee, Manager           | Pelaporan masalah kerja & pembaruan penanganan   |
| **Safety**     | PBI-14   | `GET, POST, PUT, DELETE /api/v1/safety-incidents`        | Employee, Manager           | Pencatatan insiden K3 & status penyelesaian      |
| **Training**   | PBI-05   | `GET, POST, PUT, DELETE /api/v1/trainings`               | Admin, Manager              | Pengelolaan katalog program pelatihan            |
| **Training**   | PBI-06   | `GET, POST, PUT, DELETE /api/v1/training-participations` | Admin, Manager, Employee    | Pendaftaran & pemantauan kelulusan pelatihan     |
| **Competency** | PBI-13   | `GET, POST, PUT, DELETE /api/v1/employee-competencies`   | Employee, Manager           | Pencatatan level keterampilan saat ini vs target |
| **Analytics**  | PBI-11   | `POST, GET /api/v1/analytics/workload-risk`              | Manager (Self: Employee)    | Kalkulasi & pembacaan skor _Workload Risk_       |
| **Analytics**  | PBI-17   | `POST, GET /api/v1/analytics/decent-work-score`          | Manager, Admin              | Kalkulasi & pembacaan _Decent Work Score_        |
| **Dashboard**  | PBI-10   | `GET /api/v1/dashboard/manager`                          | Manager                     | Ringkasan KPI tim, kategori risiko & masalah     |
| **Analytics**  | PBI-15   | `GET /api/v1/analytics/trends`                           | Manager                     | Perbandingan tren antar-periode & departemen     |
| **Action**     | PBI-18   | `GET /api/v1/recommendations`                            | Manager                     | Daftar rekomendasi tindakan berbasis aturan      |
| **Action**     | FR-21    | `GET, POST, PUT /api/v1/improvement-actions`             | Manager                     | Pencatatan & audit monitoring tindak lanjut      |
| **Reports**    | PBI-16   | `POST, GET /api/v1/reports/work-condition`               | Manager                     | Pembuatan & pengunduhan laporan periodik         |

---

## 4. Keamanan, Privasi & Konfigurasi Model

1. **Middleware Otorisasi, JWT & Privasi:**
   - Setiap _endpoint_ terautentikasi dilindungi guard **`auth:jwt`** (`App\Auth\JwtGuard` + `App\Services\JwtService` HS256 dengan validasi `exp`/`nbf`/`typ` dan tabel pencabutan `jwt_revoked_tokens`) serta pemeriksaan peran (`role:admin`, `role:manager`, `role:employee`).
   - Frontend SPA (`services/api.js` + `AuthContext.jsx`) menangani pembaruan Access Token otomatis via *single-flight mutex* `POST /api/v1/auth/refresh` saat menerima `401` dan mengarahkan ke `/login` bila Refresh Token telah kedaluwarsa atau dicabut.
   - **Isolasi Data Survei (NFR-02):** Query pada `SurveyController` untuk peran `manager` wajib melakukan agregasi tingkat departemen (`AVG(work_life_balance_score)`, `COUNT(*)`) dan dilarang mengembalikan identitas responden maupun komentar mentah per individu.
2. **Konfigurasi Parameter Dinamis (NFR-07 & NFR-08):**
   - Ambang batas indikator _Workload Risk_ (batas jam normal `40`, batas kritis `55`, rasio beban `1.0–1.5`) serta bobot 6 dimensi _Decent Work Score_ disimpan pada tabel/konfigurasi sistem yang dapat diubah oleh `Admin` tanpa mengubah kode sumber (_hardcode_).
   - Setiap perubahan konfigurasi bobot model dan status `improvement_actions` wajib menulis log ke `action_updates` sebagai jejak audit.
