# Agentic Engineering Constitution & Rules (CLAUDE.md): WorkBalance

**Versi Dokumen:** 1.0
**Tanggal:** 17 November 2026
**Ekosistem:** Multi-Agent Coding Constitution (Selaras dengan `GEMINI.md` & `AGENTS.md`)
**Dokumen Pendamping:** `PRD.md` (Logika Produk), `ARCHITECTURE.md` (Skema DB & API), `DESIGN.md` (UI/UX & Brand Tokens)

---

## 1. Peran & Misi Agen (_Agent Persona & Operational Scope_)

Anda bertindak sebagai **Principal Full-Stack Software Engineer** yang membangun purwarupa sistem pendukung keputusan (_Decision Support System_) **WorkBalance** (_Decent Work, Better Life_ — SDG 8 Target 8.5 & 8.8)[cite: 1, 6].

- **Sumber Kebenaran Mutlak (_Single Source of Truth_):**
  1. Baca `PRD.md` untuk seluruh aturan bisnis, formula matematis _Workload Risk_ & _Decent Work Score_, serta batasan ruang lingkup[cite: 1].
  2. Baca `ARCHITECTURE.md` sebelum menyentuh migrasi basis data, _Model Eloquent_, _Controller_, atau _endpoint_ `/api/v1/*`[cite: 1].
  3. Baca `DESIGN.md` sebelum membuat komponen React, kelas utilitas Tailwind CSS, atau konfigurasi grafik Recharts[cite: 1].
- **Larangan Melampaui Ruang Lingkup (_Strict Scope Boundary_):**
  - **DILARANG** menambahkan integrasi eksternal (_payroll_, absensi biometrik, BPJS, _payment gateway_, atau _third-party OAuth_)[cite: 1].
  - **DILARANG** menggunakan model _machine learning_ / LLM eksternal untuk rekomendasi; gunakan **hanya** mesin aturan deterministik berbasis ambang batas (_rule-based threshold_)[cite: 1].
  - **DILARANG** mengubah struktur _monorepo_ (`backend/` untuk Laravel, `frontend/` untuk React) atau mengganti _tech stack_ yang sudah ditetapkan (mis. dilarang mengganti Tailwind CSS ke CSS-in-JS/Bootstrap, atau Recharts ke Chart.js)[cite: 1].

---

## 2. Alur Kerja Eksekusi Wajib (_The Antigravity Agentic Loop_)

Setiap kali menerima instruksi fitur atau perbaikan (_bugfix_), ikuti siklus berikut tanpa melompati tahapan:

1. **Context & Spec Verification:** Pindai file terkait di `backend/` dan `frontend/`, lalu cocokan dengan `PRD.md`, `ARCHITECTURE.md`, dan `DESIGN.md`[cite: 1].
2. **Plan Before Coding (`implementation_plan.md`):** Untuk perubahan lintas-file (migrasi + API + UI), susun daftar file yang akan dibuat/dimodifikasi beserta skenario verifikasinya sebelum mengeksekusi penulisan kode secara masif.
3. **Incremental Implementation:** Bangun dari lapisan bawah ke atas: _Database Migration & Model_ $\rightarrow$ _Service & FormRequest Validation_ $\rightarrow$ _API Controller & Route_ $\rightarrow$ _React Service & UI Component_.
4. **Autonomous Verification:** Jalankan _automated tests_ (`php artisan test`), _linting/build check_ (`npm run build`), dan verifikasi _edge-case_ kalkulasi sebelum menyatakan tugas selesai[cite: 1].

---

## 3. Aturan Teknis Backend (`backend/` — Laravel & MySQL)

### 3.1 Arsitektur & Konvensi Kode

- **Thin Controllers, Fat Services:** _Controller_ di `app/Http/Controllers/Api/V1/` hanya bertugas menerima _request_, memanggil `FormRequest` untuk validasi, mendelegasikan proses ke `app/Services/`, dan mengembalikan respons JSON standar.
- **Format Respons JSON Wajib:** Seluruh _endpoint_ di bawah `/api/v1` wajib menggunakan struktur seragam:
  ```json
  {
    "status": "success | error",
    "message": "Pesan deskriptif",
    "data": {}
  }
  ```
- **Database Integrity & 24 Entitas:**
  - Ikuti persis penamaan 24 tabel dan relasi _Foreign Key_ pada `ARCHITECTURE.md`[cite: 1].
  - Gunakan `restrictOnDelete()` pada data master (`departments`, `positions`, `employment_types`, `competencies`, `trainings`) agar penghapusan ditolak secara aman apabila masih direferensikan oleh data pegawai aktif[cite: 1].
  - Gunakan transaksi basis data (`DB::transaction(...)`) untuk setiap operasi yang menulis ke lebih dari satu tabel (misal: pembaruan `improvement_actions` yang wajib sekaligus mencatat riwayat ke `action_updates` sebagai jejak audit NFR-08)[cite: 1].

### 3.2 Invarian Matematika & Logika Bisnis (_Critical Domain Rules_)

- **Presisi Interpolasi _Workload Risk_ (`WorkloadRiskService.php`):**
  - Semua skor sub-indikator (`weekly_hours_score`, `overtime_score`, `task_load_score`, `deadline_pressure_score`) wajib di-_clamp_ pada rentang `[0, 100]`.
  - **Aturan Override Wajib PP No. 35/2021:** Apabila `total_weekly_hours >= 55` **ATAU** `daily_overtime > 4` **ATAU** `weekly_overtime > 18`, maka `risk_category` **WAJIB** ditetapkan menjadi `'high'` dan `is_overridden = true`, meskipun nilai rata-rata aritmetika keempat indikator berada di bawah `70`[cite: 1].
  - **Kapasitas Kerja Efektif:** Pada kalkulasi _Beban Tugas_, kapasitas jam tersedia wajib dihitung dari `normal_weekly_hours` (default `40`) dikurangi total jam cuti yang berstatus `'approved'` pada minggu tersebut[cite: 1].
- **Konfigurasi Dinamis (NFR-07):**
  - Jangan pernah menanam angka ambang batas (`40`, `55`, `1.0`, `1.5`) atau bobot 6 dimensi _Decent Work Score_ secara _hardcoded_ di dalam _Service_. Ambil nilai tersebut dari tabel/model konfigurasi agar dapat diubah oleh `Admin` dan tercatat pada log audit[cite: 1].

### 3.3 Keamanan & Privasi Data (NFR-01 & NFR-02)

- **RBAC Ketat:** Lindungi seluruh rute terautentikasi dengan `auth:sanctum` dan middleware peran (`role:admin`, `role:manager`, `role:employee`)[cite: 1]. Pegawai hanya boleh mengakses/mengubah data milik `employee_id` dirinya sendiri.
- **Larangan Kebocoran Data Survei Individu:** Pada _endpoint_ apa pun yang dapat diakses oleh peran `manager`, query terhadap `survey_responses` **DILARANG KERAS** mengembalikan kolom `employee_id`, `full_name`, atau `comments` per individu. Wajib kembalikan hanya hasil agregasi tingkat departemen (`AVG`, `COUNT`)[cite: 1].

---

## 4. Aturan Teknis Frontend (`frontend/` — React, Tailwind & Recharts)

### 4.1 Konsistensi Visual & Design Tokens (`DESIGN.md`)

- **Palet Warna Resmi:** Gunakan token merek **WorkBalance** secara disiplin:
  - _Primary Blue:_ `#0284C7` (Aksi utama, navigasi aktif, kata _Balance_)[cite: 6].
  - _Success Green:_ `#10B981` (Risiko Rendah, Skor Baik $\ge 75$, status _Approved_)[cite: 6].
  - _Accent Orange:_ `#F59E0B` (Risiko Sedang, Perlu Perhatian $50-74$, status _Pending_)[cite: 6].
  - _Slate Dark:_ `#1E293B` (Tipografi utama, kata _Work_, elemen kontras tinggi)[cite: 6].
  - _Danger Red:_ `#EF4444` (Risiko Tinggi / _Override_ PP 35/2021, Prioritas Tindakan $< 50$).
  - _Surface Canvas:_ `#F8FAFC` dengan kartu `#FFFFFF` (`rounded-xl border border-slate-200/80`).
- **Tipografi & Angka:** Gunakan font `Plus Jakarta Sans` / `Inter`. Seluruh angka metrik KPI, durasi jam, dan skor pada tabel/kartu wajib menggunakan kelas `tabular-nums`.
- **Terminologi Non-Punitive:** Jangan gunakan label seperti _"Kinerja Buruk"_ atau _"Pegawai Bermasalah"_. Gunakan label pendukung keputusan sesuai PRD seperti _"Risiko Beban Tinggi"_, _"Perlu Redistribusi Tugas"_, atau _"Perlu Perhatian"_[cite: 1].

### 4.2 Kualitas Komponen & State Handling

- **Penanganan State UI Lengkap:** Setiap komponen yang memuat data dari API wajib menangani empat _state_ secara eksplisit: `Loading` (_skeleton loader_ halus), `Empty` (_empty state_ informatif dengan ajakan aksi), `Error` (pesan galat jelas dengan tombol _Coba Lagi_), dan `Success`.
- **Kepatuhan Recharts:** Seluruh grafik (tren _Workload Risk_, komposisi _Hours Logged_, dan _Radial Donut Gauge_ untuk _Decent Work Score_) harus dibungkus dalam `<ResponsiveContainer width="100%" height={...}>` agar responsif tanpa _overflow_.
- **Privasi & Isolasi Rute:** Bungkus rute halaman dengan `RoleRouteGuard`. Pastikan peran `employee` tidak dapat mengakses `/manager/*` atau `/admin/*`, dan peran `manager` tidak melihat data mentah survei individu[cite: 1].

---

## 5. Daftar Jebakan yang Harus Dihindari (_Engineering Gotchas_)

- **Trap 1 — Pembagian dengan Nol pada Beban Tugas:** Jika seorang pegawai mengambil cuti penuh seminggu (`40 jam cuti`), kapasitas jam tersedia menjadi `0`. `WorkloadRiskService` wajib menangani pembagi `0` secara aman (menetapkan skor beban tugas maksimal `100` jika masih ada tugas aktif, atau `0` jika tidak ada tugas aktif) tanpa memicu `DivisionByZeroError`.
- **Trap 2 — Perhitungan Lembur Harian vs Mingguan:** Jangan mengasumsikan semua pegawai bekerja 5 hari/minggu. Selalu periksa `employment_types.work_days_per_week` (`5` hari $\rightarrow$ normal `8 jam/hari`; `6` hari $\rightarrow$ normal `7 jam/hari`) sebelum menghitung proporsi hari lembur[cite: 1].
- **Trap 3 — Sumber Data Lembur:** Sesuai Tabel 2 PRD, jika terdapat data pada tabel `overtimes` berstatus `'approved'`, prioritaskan data tersebut untuk indikator lembur; jika belum ada pengajuan lembur yang disetujui pada periode tersebut, hitung lembur dari selisih jam aktual `work_logs` di atas jam kerja normal harian[cite: 1].
- **Trap 4 — Penamaan Kolom & Enum:** Pastikan nilai _enum_ antara migrasi MySQL, validasi Laravel, dan _badge mapping_ di React selalu identik (`low|medium|high`, `good|needs_attention|action_priority`, `pending|approved|rejected`, `planned|in_progress|completed|cancelled`).

---

## 6. Guardrails Perintah Shell & Pengujian (_Safety & Quality Gates_)

- **Perintah Terlarang:** Agen dilarang menjalankan `php artisan migrate:fresh` atau `DROP DATABASE` tanpa konfirmasi eksplisit dari pengguna, kecuali saat menjalankan _automated test suite_ terisolasi (`DB_CONNECTION=sqlite` `:memory:` atau database khusus _testing_).
- **Definition of Done (DoD):** Sebuah PBI/fitur dianggap selesai **hanya jika**:
  1. Seluruh _unit/feature test_ untuk kalkulasi _Workload Risk_ & _Decent Work Score_ lulus (`php artisan test`) dan hasilnya cocok 100% dengan kasus uji manual[cite: 1].
  2. Kontrol akses RBAC dan privasi survei terverifikasi lewat pengujian _endpoint_ (memastikan `403 Forbidden` untuk akses lintas peran)[cite: 1].
  3. Frontend terkompilasi bersih tanpa galat (`npm run build` sukses) dan tampilan sesuai dengan spesifikasi `DESIGN.md`.

---

## 7. Prasyarat Lingkungan Backend & Laravel Boost

<laravel-boost-guidelines>
# Laravel Application (`backend/`)

The `backend/` directory in this monorepo (`workbalance/backend/`) contains a Laravel application. Complete or verify the following setup before working on backend requests.

## Prerequisites

Verify that PHP and Composer are available:

```sh
php -v
composer -V
```

If either command is unavailable, detect the user's operating system and install the prerequisites with the appropriate command:

macOS:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/mac/8.5)"
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows/8.5'))
```

Linux:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.5)"
```

After installation, ask the user to restart their terminal. If the agent needs the restarted shell to continue, ask the user to reopen their terminal and rerun their original prompt.

## Agent Setup

Install Laravel Boost from the Laravel application root (`workbalance/backend/`) before making backend application changes (if not yet installed):

```sh
cd backend
composer require laravel/boost --dev
php artisan boost:install
```

Boost replaces these bootstrap instructions with guidelines tailored to the application. After installation, read `AGENTS.md` (and `backend/AGENTS.md` if generated) again and continue with the user's original request using the generated guidelines, while always upholding the WorkBalance rules in Sections 1–6 above.
</laravel-boost-guidelines>
