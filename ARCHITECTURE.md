# System Architecture Blueprint (`ARCHITECTURE.md`): WorkBalance

**Versi Dokumen:** 1.0  
**Tanggal:** 17 November 2026  
**Referensi Produk:** `PRD.md` (WorkBalance — SDG 8 Decision Support System)

---

## 1. Arsitektur Sistem & Tech Stack

WorkBalance dirancang menggunakan arsitektur **decoupled Client-Server (SPA + RESTful API)** yang dioptimalkan untuk lingkungan pengembangan lokal (*local development environment*). Pemisahan ini memastikan logika kalkulasi indikator dan penegakan kontrol akses (RBAC) terisolasi aman di sisi server.

### 1.1 Teknologi Utama
* **Frontend:** React (Single Page Application) dengan arsitektur komponen modular.
* **Styling & UI Framework:** Tailwind CSS.
* **Data Visualization:** Recharts (untuk grafik tren garis, *stacked/grouped bar chart*, dan *radial/donut gauge*).
* **Backend API:** Laravel (RESTful JSON API, *calculation engine* untuk *Workload Risk* & *Decent Work Score*, serta penjadwalan periodik).
* **Database:** MySQL (basis data relasional dengan 24 entitas dan penegakan *Foreign Key constraints*).
* **Authentication & Authorization:** Laravel Sanctum (*token-based authentication*) + *Role-Based Access Control* (`Employee`, `Manager`, `Admin`).
* **Version Control & Testing:** Git; PHPUnit/Pest (pengujian otomatis logika indikator backend) & pengujian fungsional alur utama.

### 1.2 Pemetaan Lapisan Arsitektur (ArchiMate Alignment)
1. **Business Layer:** Aktor `Pegawai`, `Manager`, dan `Admin` berinteraksi dengan layanan pemantauan kondisi kerja (*WorkBalance Service*) melalui pencatatan operasional, analisis risiko, dan tindak lanjut perbaikan.
2. **Application Layer:**
   * *Web UI (React):* Menyajikan antarmuka berbasis peran dan visualisasi dasbor.
   * *Authentication & RBAC Module:* Memverifikasi kredensial dan membatasi akses *endpoint* sesuai peran.
   * *Analytics & Recommendation Engine:* Memproses data operasional menjadi skor *Workload Risk*, *Decent Work Score*, dan pemicu rekomendasi berbasis aturan.
   * *Backend API (Laravel):* Menangani validasi permintaan, transaksi CRUD, dan pertukaran data JSON.
3. **Technology Layer:** *Local Development Environment* yang menjalankan server aplikasi lokal dan layanan *MySQL Database*.

### 1.3 Struktur Direktori Proyek
```text
workbalance/
├── backend/                     # Laravel REST API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/
│   │   │   ├── Middleware/      # RoleMiddleware (RBAC) & SurveyPrivacyGuard
│   │   │   └── Requests/        # FormRequest Validation
│   │   ├── Models/              # 24 Eloquent Models
│   │   └── Services/
│   │       ├── WorkloadRiskService.php      # Interpolasi linear & override PP 35/2021
│   │       ├── DecentWorkScoreService.php   # Agregasi 6 dimensi departemen
│   │       └── RecommendationEngine.php     # Rule-based threshold trigger
│   ├── database/
│   │   ├── migrations/          # 24 skema tabel relasional
│   │   └── seeders/             # Dummy dataset untuk kasus uji
│   └── routes/api.php           # Prefix /api/v1/*
└── frontend/                    # React + Tailwind CSS
    ├── public/assets/           # workbalance_logo.svg, workbalance_horizontal_logo.svg
    └── src/
        ├── components/          # UI Primitives, Charts (Recharts), Layouts
        ├── context/             # AuthContext & RoleGuard
        ├── pages/
        │   ├── employee/        # Dashboard pribadi, WorkLog, Cuti/Lembur, Survei, K3, Kompetensi
        │   ├── manager/         # Executive Dashboard, Workload Risk, Decent Work, Rekomendasi, Laporan
        │   └── admin/           # Master Data (Pegawai, Dept, Posisi), Konfigurasi Bobot Model
        └── services/            # Axios API client (/api/v1)
```

---

## 2. Rancangan Basis Data (24 Entitas Relasional)

Basis data MySQL dikelompokkan ke dalam 5 domain fungsional dengan integritas referensial ketat (*restrict delete* pada data master yang aktif direferensikan):

### Domain A: Pengguna & Struktur Organisasi (5 Entitas)
1. `user_accounts`: `id`, `email` (unique), `password_hash`, `role` (`admin`, `manager`, `employee`), `is_active`, `remember_token`, `timestamps`.
2. `departments`: `id`, `name`, `code` (unique), `description`, `manager_id` (FK $\rightarrow$ `employees.id`, nullable), `timestamps`.
3. `positions`: `id`, `title`, `level`, `description`, `timestamps`.
4. `employment_types`: `id`, `name` (Tetap, Kontrak, Magang), `work_days_per_week` (`5` atau `6` — menentukan ambang lembur harian 8 jam vs 7 jam), `normal_weekly_hours` (default `40`), `timestamps`.
5. `employees`: `id`, `user_account_id` (FK), `department_id` (FK), `position_id` (FK), `employment_type_id` (FK), `employee_code` (unique), `full_name`, `join_date`, `status` (`active`, `inactive`), `timestamps`.

### Domain B: Tugas & Aktivitas Kerja (6 Entitas)
6. `tasks`: `id`, `department_id` (FK), `created_by` (FK $\rightarrow$ `employees.id`), `title`, `description`, `estimated_hours`, `priority` (`low`, `medium`, `high`, `critical`), `due_date`, `status` (`todo`, `in_progress`, `completed`), `timestamps`.
7. `task_assignments`: `id`, `task_id` (FK), `employee_id` (FK), `assigned_by` (FK $\rightarrow$ `employees.id`), `assigned_at`, `deadline`, `status` (`assigned`, `in_progress`, `completed`), `timestamps`.
8. `work_logs`: `id`, `employee_id` (FK), `task_assignment_id` (FK, nullable), `work_date`, `hours_spent`, `activity_description`, `timestamps`.
9. `overtimes`: `id`, `employee_id` (FK), `overtime_date`, `duration_hours`, `reason`, `status` (`pending`, `approved`, `rejected`), `approved_by` (FK $\rightarrow$ `employees.id`, nullable), `timestamps`.
10. `leave_requests`: `id`, `employee_id` (FK), `leave_type` (`annual`, `sick`, `personal`), `start_date`, `end_date`, `total_hours`, `reason`, `status` (`pending`, `approved`, `rejected`), `approved_by` (FK $\rightarrow$ `employees.id`, nullable), `timestamps`.
11. `compensations`: `id`, `employee_id` (FK), `period_month` (`YYYY-MM`), `base_salary`, `allowances`, `benefits`, `is_complete` (boolean untuk dimensi *Decent Work Score*), `timestamps`.

### Domain C: Kesejahteraan, Suara Pekerja & K3 (4 Entitas)
12. `work_surveys`: `id`, `title`, `period_month` (`YYYY-MM`), `description`, `is_active`, `timestamps`.
13. `survey_responses`: `id`, `work_survey_id` (FK), `employee_id` (FK), `work_life_balance_score` (int 1–5), `workload_perception_score` (int 1–5), `comments`, `submitted_at`.  
    * *Constraint Privasi (NFR-02):* Query untuk peran `Manager` dilarang mengambil baris individual (`employee_id` / `comments`); hanya diizinkan melakukan agregasi (`AVG()`, `COUNT()`) berdasarkan `department_id`.
14. `workplace_issues`: `id`, `reported_by` (FK $\rightarrow$ `employees.id`), `department_id` (FK), `category`, `description`, `status` (`open`, `in_progress`, `resolved`), `resolution_notes`, `resolved_at`, `timestamps`.
15. `safety_incidents`: `id`, `reported_by` (FK $\rightarrow$ `employees.id`), `department_id` (FK), `incident_date`, `location`, `severity` (`minor`, `moderate`, `severe`), `description`, `status` (`reported`, `investigating`, `resolved`), `timestamps`.

### Domain D: Pelatihan & Kompetensi (4 Entitas)
16. `trainings`: `id`, `title`, `category`, `provider`, `duration_hours`, `start_date`, `end_date`, `timestamps`.
17. `training_participations`: `id`, `training_id` (FK), `employee_id` (FK), `status` (`enrolled`, `completed`, `dropped`), `completion_date`, `timestamps`.
18. `competencies`: `id`, `name`, `category`, `description`, `timestamps`.
19. `employee_competencies`: `id`, `employee_id` (FK), `competency_id` (FK), `current_level` (int 1–5), `target_level` (int 1–5), `last_assessed_at`, `timestamps`.

### Domain E: Analitik, Rekomendasi & Jejak Audit Tindak Lanjut (5 Entitas)
20. `workload_risks`: `id`, `employee_id` (FK), `period_week` (`YYYY-Www`), `period_month` (`YYYY-MM`), `weekly_hours_score`, `overtime_score`, `task_load_score`, `deadline_pressure_score`, `final_score`, `risk_category` (`low`, `medium`, `high`), `is_overridden` (boolean PP 35/2021), `timestamps`.
21. `decent_work_scores`: `id`, `department_id` (FK), `period_month` (`YYYY-MM`), `dim_workload_score`, `dim_wlb_score`, `dim_compensation_score`, `dim_safety_score`, `dim_voice_score`, `dim_competency_score`, `final_score`, `status_category` (`good`, `needs_attention`, `action_priority`), `timestamps`.
22. `recommendations`: `id`, `target_type` (`employee`, `department`), `target_id`, `period`, `trigger_source`, `title`, `suggested_action`, `priority`, `is_adopted` (boolean), `timestamps`.
23. `improvement_actions`: `id`, `recommendation_id` (FK, nullable), `department_id` (FK), `pic_employee_id` (FK $\rightarrow$ `employees.id`), `title`, `action_plan`, `due_date`, `status` (`planned`, `in_progress`, `completed`, `cancelled`), `timestamps`.
24. `action_updates`: `id`, `improvement_action_id` (FK), `updated_by` (FK $\rightarrow$ `employees.id`), `previous_status`, `new_status`, `notes`, `created_at` (Jejak audit NFR-08).

*(Catatan NFR-07: Bobot dimensi dan ambang batas indikator disimpan dalam tabel/file konfigurasi model yang dapat diubah oleh `Admin` dan dicatat perubahannya).*

---

## 3. Spesifikasi Kontrak REST API (`/api/v1`)

Seluruh pertukaran data menggunakan format JSON standar:
```json
{
  "status": "success | error",
  "message": "Deskripsi singkat hasil operasi",
  "data": {}
}
```

### 3.1 Autentikasi & Sesi
| PBI / Ref | Method & Endpoint | Akses Peran | Deskripsi |
| :--- | :--- | :--- | :--- |
| `AUTH-01` | `POST /api/v1/auth/register` | Public / Admin | Mendaftarkan akun pengguna baru ke dalam sistem. |
| `AUTH-02` | `POST /api/v1/auth/login` | Public | Memverifikasi kredensial dan menerbitkan token Sanctum. |
| `AUTH-03` | `GET /api/v1/auth/me` | Authenticated | Mengambil profil pengguna aktif beserta hak akses perannya (RBAC). |
| `AUTH-04` | `DELETE /api/v1/auth/logout` | Authenticated | Mengakhiri sesi pengguna dan mencabut token autentikasi. |

### 3.2 Data Master & Organisasi
| PBI / Ref | Method & Endpoint | Akses Peran | Deskripsi |
| :--- | :--- | :--- | :--- |
| `PBI-01` | `GET, POST, PUT, DELETE /api/v1/employees` | Admin (Read: Manager) | CRUD data master pegawai & jenis kepegawaian. |
| `PBI-02` | `GET, POST, PUT, DELETE /api/v1/departments` | Admin (Read: Manager) | CRUD data departemen & struktur organisasi. |
| `PBI-11` | `GET, POST, PUT, DELETE /api/v1/positions` | Admin (Read: Manager) | CRUD data jabatan/posisi pegawai. |

### 3.3 Operasional Tugas, Aktivitas, Kesejahteraan & Kompetensi
| PBI / Ref | Method & Endpoint | Akses Peran | Deskripsi |
| :--- | :--- | :--- | :--- |
| `PBI-03` | `GET, POST, PUT, DELETE /api/v1/tasks` | Manager (Read: Employee) | CRUD tugas, estimasi jam, prioritas, dan tenggat. |
| `PBI-04` | `GET, POST, PUT, DELETE /api/v1/task-assignments` | Manager (Read: Employee) | Penetapan dan pembaruan penugasan kerja pegawai. |
| `PBI-12` | `GET, POST, PUT, DELETE /api/v1/work-logs` | Employee (Read: Manager) | Pencatatan dan riwayat waktu aktual aktivitas kerja. |
| `FR-09/10` | `GET, POST, PUT /api/v1/overtimes`, `/leave-requests` | Employee & Manager | Pengajuan lembur/cuti oleh Pegawai; persetujuan oleh Manager. |
| `PBI-05` | `GET, POST, PUT, DELETE /api/v1/trainings` | Admin, Manager (Read: All) | Pengelolaan katalog program pelatihan. |
| `PBI-06` | `GET, POST, PUT, DELETE /api/v1/training-participations` | Admin, Manager | Pendaftaran & pemantauan status keikutsertaan pelatihan. |
| `PBI-07` | `GET, POST, PUT, DELETE /api/v1/surveys` | Admin/Manager & Employee | Pembuatan survei & pengiriman respons survei pegawai. |
| `PBI-08` | `GET, POST, PUT, DELETE /api/v1/workplace-issues` | Employee & Manager | Pelaporan permasalahan kerja & pembaruan status penanganan. |
| `PBI-13` | `GET, POST, PUT, DELETE /api/v1/employee-competencies` | Employee, Manager | Pencatatan keterampilan dan tingkat kompetensi pegawai. |
| `PBI-14` | `GET, POST, PUT, DELETE /api/v1/safety-incidents` | Employee, Manager | Pencatatan insiden K3 beserta status penanganannya. |

### 3.4 Analitik, Dasbor, Rekomendasi & Pelaporan
| PBI / Ref | Method & Endpoint | Akses Peran | Deskripsi |
| :--- | :--- | :--- | :--- |
| `PBI-09` | `GET /api/v1/dashboard/manager` | Manager | Mengambil ringkasan KPI kondisi kerja, beban kerja, dan permasalahan tim. |
| `PBI-10` | `POST, GET /api/v1/analytics/workload-risk` | Manager (Self: Employee) | Menghitung ulang (`POST`) dan mengambil (`GET`) skor *Workload Risk*. |
| `PBI-17` | `POST, GET /api/v1/analytics/decent-work-score` | Manager, Admin | Menghitung ulang (`POST`) dan mengambil (`GET`) *Decent Work Score* departemen. |
| `PBI-15` | `GET /api/v1/analytics/trends` | Manager | Mengambil perbandingan tren kondisi kerja berdasarkan filter periode & departemen. |
| `PBI-18` | `GET /api/v1/recommendations` | Manager | Mengambil daftar rekomendasi tindakan berbasis ambang batas risiko. |
| `FR-21` | `GET, POST, PUT /api/v1/improvement-actions` | Manager | Mencatat dan memantau status tindakan perbaikan beserta jejak audit. |
| `PBI-16` | `POST, GET /api/v1/reports/work-condition` | Manager | Menghasilkan (`POST`) dan mengunduh (`GET`) laporan kondisi kerja periodik. |
```

Sekarang Anda memiliki pemisahan dokumen yang sangat rapi dan siap dipakai agen Antigravity: `PRD.md` (produk & logika bisnis), `ARCHITECTURE.md` (tech stack, ERD 24 tabel, & kontrak API), serta berikutnya Anda dapat membuat `DESIGN.md` khusus untuk aset logo, palet warna WCAG, tipografi, dan pola tata letak komponen UI.