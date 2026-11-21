# UI/UX & Brand Identity Design System (DESIGN.md): WorkBalance

**Versi Dokumen:** 2.0 (Calm Enterprise Precision — Anti-AI-Slop Edition)  
**Tanggal:** 21 November 2026  
**Mode Permukaan:** `Operate` (Enterprise Workforce & SDG 8 Decision Support System)  
**Referensi Produk & Teknis:** `PRD.md` & `ARCHITECTURE.md`  
**Tagline Merek:** _"Decent Work, Better Life"_

---

## 1. Filosofi Visual & Batasan Mutlak (_Guardrails_)

Dokumen ini menjadi satu-satunya sumber kebenaran (*single source of truth*) untuk seluruh implementasi frontend **WorkBalance** dengan **React 19**, **Tailwind CSS v4 (OKLCH)**, **`shadcn/ui` (Radix Primitives)**, **Recharts**, dan **TanStack Table**.

### 1.1 Prinsip Estetika ("Calm Enterprise Precision")
WorkBalance adalah alat kerja harian (*Operate mode*) bagi Pegawai, Manajer, dan Admin HR—bukan halaman brosur. Kualitas visual hadir lewat **presisi, ketenangan, konsistensi, dan hierarki yang jujur**, bukan dekorasi ramai:

- **Aturan Distribusi Warna 90 / 10 (Anti-Slop):**
  - **90% permukaan adalah lapisan netral terkalibrasi** (sidebar netral-sejuk, kanvas konten alabaster-terang, kartu putih bersih berbingkai hairline `1px`).
  - **10% warna merek & semantik** digunakan **hanya** untuk aksi utama (CTA), item navigasi aktif, titik/badge indikator status, dan seri data grafik.
  - **DILARANG** memenuhi kartu KPI dengan kotak ikon persegi pastel mencolok atau menumpuk kartu di dalam kartu (*nested cards*).
- **Deklarasi Elevasi Tunggal:**
  - Permukaan statis (kartu, tabel, toolbar) memakai **`1px` hairline border (`border-border`) tanpa bayangan kabur lebar**.
  - Bayangan (*shadow*) dicadangkan eksklusif untuk lapisan mengambang (*Popover*, *DropdownMenu*, *Tooltip*, *Sheet*, *Dialog*, *Command Palette*).
- **Tanpa Kicker / Eyebrow Dekoratif:**
  - Judul halaman (`H1`) dan judul seksi (`H2`) berdiri kuat sendiri—**dilarang** menaruh label uppercase mikro dekoratif di atas judul. Breadcrumb ditempatkan tenang di top bar, bukan di atas setiap kartu.
- **Privasi Visual Survei (Mutlak):**
  - Antarmuka `manager` **dilarang keras** merender tabel atau daftar komentar/skor survei per individu. Seluruh visualisasi survei Manajer wajib berupa metrik agregat departemen.
- **Non-Punitive Visual Language:**
  - Hindari terminologi penghakiman individu (*"Kinerja Buruk"*, *"Pegawai Bermasalah"*). Gunakan bahasa dukungan keputusan: *"Risiko Beban Tinggi — Perlu Redistribusi"*, *"Perlu Perhatian"*, *"Prioritas Tindakan"*.
- **Interaksi & Permukaan Browser Terkurasi:**
  - `::selection`, `caret-color`, `:focus-visible` ring, dan `tabular-nums` wajib mengikuti palet WorkBalance di `src/index.css`.
  - Transisi interaksi cepat dan bertujuan (`150–220ms`, *ease-out*): hanya untuk perubahan state, buka/tutup drawer, dan umpan balik—**dilarang** menaruh animasi *stagger* panjang saat halaman operasional dimuat.

---

## 2. Brand Identity & Aset Logo

### 2.1 Filosofi & Anatomi Logo
Logo **WorkBalance** terdiri atas tiga pilar vertikal berujung membulat (*capsule bars*) yang disatukan satu garis lengkung (*arc*):
- **Pilar Kiri (`#0284C7` — Primary Blue):** Struktur tugas dan profesionalisme kerja.
- **Pilar Tengah (`#10B981` — Success Green, tertinggi):** Kesejahteraan, kesehatan, dan pertumbuhan berkelanjutan (SDG 8).
- **Pilar Kanan (`#F59E0B` — Accent Orange):** Kewaspadaan dini dan dinamika beban kerja.
- **Lengkungan Penyeimbang (`#1E293B` — Slate Dark):** Titik tumpu keseimbangan (*equilibrium*).

### 2.2 Penempatan Aset (`frontend/public/assets/`)

| Nama File | Varian | Ukuran | Lokasi Penggunaan |
| :--- | :--- | :--- | :--- |
| `workbalance_horizontal_logo_2.svg` | Horizontal Lockup | `h-8` (`32px`, auto width) | Header Sidebar (expanded), Login Panel, Kop Laporan. |
| `workbalance_logo_2.svg` | Standalone Icon | `size-8` (`32px × 32px`) | Favicon, Header Sidebar (collapsed rail), Loading Brand Mark. |

---

## 3. Design Tokens (Tailwind CSS v4 & OKLCH Semantic Palette)

Seluruh komponen baru **WAJIB** menggunakan token semantik CSS (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, dst.)—**DILARANG** menulis warna hex hardcoded (`bg-[#...]`, `text-[#...]`) di dalam JSX.

### 3.1 Lapisan Permukaan & Warna Semantik (`src/index.css`)

| Token Semantik | Nilai OKLCH | Peran Permukaan |
| :--- | :--- | :--- |
| `--background` | `oklch(0.988 0.003 247)` | Kanvas konten utama (terang, tenang, nyaris putih) |
| `--sidebar` | `oklch(0.974 0.005 247)` | Lapisan netral kedua untuk Sidebar & rail navigasi |
| `--card` | `oklch(1 0 0)` | Kartu data, tabel, panel formulir (putih bersih) |
| `--muted` | `oklch(0.955 0.006 247)` | Hover baris, tab list, input search tenang |
| `--border` | `oklch(0.905 0.008 247)` | Hairline `1px` pemisah kartu, sidebar, & tabel |
| `--foreground` | `oklch(0.208 0.032 256)` | Teks utama (`#1E293B` equivalent, kontras > 11:1) |
| `--muted-foreground` | `oklch(0.495 0.025 256)` | Teks sekunder, label kolom, metadata (kontras ≥ 4.6:1) |
| `--primary` | `oklch(0.562 0.148 238)` | WorkBalance Primary Blue (`#0284C7` family) untuk CTA & aktif |
| `--destructive` | `oklch(0.577 0.215 27)` | Aksi hapus & status Risiko Tinggi / Override PP 35/2021 |

### 3.2 Pemetaan Status Bisnis (Dot-Indicator Pattern)

Gunakan komponen terpusat **`<StatusBadge />`** (`src/components/workbalance/StatusBadge.jsx`). Alih-alih pill pastel mencolok tanpa batas, badge memakai latar netral/tint sangat lembut dengan bingkai tipis dan **titik indikator 6px** berpresisi tinggi:

| Domain | Kategori / Enum | Dot Color | Tone Semantik | Chart Token |
| :--- | :--- | :--- | :--- | :--- |
| **Workload Risk** | `low` (`< 40`) | `emerald-500` | Aman / Seimbang | `--chart-2` (`#10B981`) |
| **Workload Risk** | `medium` (`40–69`) | `amber-500` | Perlu Perhatian | `--chart-3` (`#F59E0B`) |
| **Workload Risk** | `high` (`≥ 70` / Override) | `rose-500` | Risiko Tinggi | `--chart-5` (`#EF4444`) |
| **Decent Work Score** | `good` (`≥ 75`) | `emerald-500` | Baik | `--chart-2` (`#10B981`) |
| **Decent Work Score** | `needs_attention` (`50–74`) | `amber-500` | Perlu Perhatian | `--chart-3` (`#F59E0B`) |
| **Decent Work Score** | `action_priority` (`< 50`) | `rose-500` | Prioritas Tindakan | `--chart-5` (`#EF4444`) |
| **Workflow & Approval** | `approved` / `completed` / `resolved` / `active` | `emerald-500` | Selesai / Aktif | `--chart-2` |
| **Workflow & Approval** | `pending` / `in_progress` | `amber-500` | Diproses / Menunggu | `--chart-3` |
| **Workflow & Approval** | `open` / `enrolled` / `planned` | `sky-500` | Terbuka / Terjadwal | `--chart-1` |
| **Workflow & Approval** | `rejected` / `cancelled` / `severe` / `inactive` | `rose-500` / `slate-400` | Ditolak / Nonaktif | `--chart-5` |

### 3.3 Tipografi & Skala Ketat (`Operate Mode`)

- **UI Sans:** `"Plus Jakarta Sans", "Inter", system-ui, sans-serif` — satu keluarga sans terkalibrasi untuk seluruh heading, label, dan isi tabel.
- **Data Monospace:** `"JetBrains Mono", ui-monospace, monospace` — digunakan **hanya** untuk kode (`EMP-001`, `ENG`), periode ISO (`2026-W47`), dan durasi/rasio pengukuran (`42.5j / 40j`).
- **Skala Tetap (`rem`, bukan `clamp` fluid):**
  - **Page Title (`H1`):** `text-xl` (`20px`), `font-semibold`, `tracking-[-0.02em]`, `text-foreground`.
  - **Section / Card Title (`H2`):** `text-sm`–`text-base` (`14px–16px`), `font-semibold`, `tracking-[-0.01em]`.
  - **KPI Hero Number:** `text-2xl`–`text-[28px]`, `font-semibold`, `tracking-[-0.025em]`, `tabular-nums`.
  - **Body & Table Cell:** `text-sm` (`14px`), `leading-5`.
  - **Table Header & Meta:** `text-xs` (`12px`), `font-medium`, `text-muted-foreground`.

---

## 4. Arsitektur App Shell & Navigasi (`AppShell` v2)

- **Collapsible Left Sidebar (`w-64` expanded / `w-[68px]` collapsed):**
  - Latar lapisan kedua `bg-sidebar border-r border-sidebar-border`.
  - **Pengelompokan Semantik (maks. 4 grup — dilarang daftar datar 11 item):**
    1. **Ikhtisar & Analitik:** Dasbor Kondisi Kerja / Beranda Pegawai, Analisis Workload Risk.
    2. **Operasional Kerja:** Manajemen Tugas, Penugasan Kerja, Catatan Waktu Kerja.
    3. **Kesejahteraan & Kompetensi:** Survei Kondisi Kerja, Permasalahan Kerja, Katalog Pelatihan, Keikutsertaan Pelatihan.
    4. **Master Organisasi** *(Admin & Manajer)*: Pegawai & Kepegawaian / Direktori Tim, Data Departemen / Struktur Departemen.
  - **Item Aktif:** Latar lembut `bg-primary/10 text-primary font-medium` (atau `bg-card text-foreground shadow-2xs ring-1 ring-border`), bukan blok biru penuh yang terlalu berat di semua baris.
  - **Footer Sidebar:** Indikator ringkas regulasi **PP No. 35/2021** (`40j normal · maks 18j lembur`) tanpa teks artefak developer (`Sprint 0 / PBI-XX`).
- **Sticky Top Header Bar (`h-14` / `56px`, `bg-background/90 backdrop-blur-sm border-b border-border`):**
  - **Kiri:** Toggle collapse sidebar (desktop) / drawer trigger (mobile) + Breadcrumb & judul halaman ringkas.
  - **Tengah/Kanan:** Tombol **Command Palette (`Ctrl+K`)** untuk pencarian modul cepat + input pencarian halaman (jika aktif) + **User DropdownMenu** (`Avatar` + nama + peran + aksi Keluar).

---

## 5. Katalog Komponen Resmi (`src/components/ui/` & `src/components/workbalance/`)

Seluruh halaman **WAJIB** mengomposisi primitif berikut (dilarang membuat `fixed inset-0` modal mentah, `<table>` mentah, atau `showToast` manual):

1. **Primitif `shadcn/ui` (`src/components/ui/`):** `Button`, `Card`, `Badge`, `Input`, `Label`, `Textarea`, `Select`, `Separator`, `Sheet`, `Dialog`, `AlertDialog`, `Table`, `Tabs`, `Tooltip`, `DropdownMenu`, `Popover`, `Command`, `Skeleton`, `Avatar`, `Progress`, `Chart`, `Sonner`.
2. **Komponen Domain WorkBalance (`src/components/workbalance/`):**
   - `PageHeader` — Judul halaman, deskripsi singkat satu baris, dan slot tombol aksi utama.
   - `KpiStatCard` — Kartu KPI bersih tanpa kotak ikon pastel besar; menampilkan label tenang, angka `tabular-nums`, status/delta ringkas, dan ambang batas opsional.
   - `StatusBadge` — Badge status dot-indicator konsisten untuk seluruh enum WorkBalance.
   - `DataTable` — Berbasis `@tanstack/react-table` + `shadcn/ui` `Table` (sorting, search toolbar, filter pills slot, skeleton rows, empty state, error retry, pagination).
   - `FormSheet` — Slide-over drawer kanan (`Sheet`) untuk form Create/Edit & panel Detail 360° Pegawai agar pengguna tetap melihat konteks daftar di belakangnya.
   - `ConfirmDialog` — `AlertDialog` terakses keyboard untuk konfirmasi hapus / tindakan destruktif.
   - `CommandMenu` — Command Palette global (`Ctrl+K` / `Cmd+K`) berbasis `cmdk`.
   - `Charts` — Grafik interaktif **Recharts** (`DecentWorkDonutChart`, `WorkHoursBarChart` dengan `<ReferenceLine y={8} />`, `WorkloadTrendAreaChart`) dibungkus `ChartContainer` berdimensi eksplisit.

---

## 6. Blueprint Halaman Utama Berdasarkan Peran

- **Autentikasi (`/login`):** Split-screen tenang dan berwibawa — panel kiri berstruktur editorial dengan ringkasan misi SDG 8 & data PP No. 35/2021 tanpa kartu kaca melayang klise; panel kanan form login bersih dengan akses cepat akun demo.
- **Workspace Pegawai (`/employee/*`):** `EmployeeDashboardPage` lengkap (4 KPI pribadi, grafik batang Recharts jam kerja harian `Sen–Min` vs garis batas 8 jam, tabel tugas aktif dengan aksi cepat Catat Work Log, dan panel Aksi Cepat).
- **Workspace Manajer (`/manager/*`):** `ManagerDashboardPage` & `WorkloadRiskPage` memakai Recharts interaktif (`DecentWorkDonutChart`, `WorkloadTrendAreaChart`, `WorkHoursBarChart`), `DataTable` prioritas perhatian, dan `FormSheet` 360° detail pegawai (tanpa kebocoran data survei individu).
- **Workspace Admin (`/admin/*`):** Halaman CRUD Master Data (`Employees`, `Departments`, `Trainings`, `TrainingParticipations`) terstruktur rapi memakai `DataTable` + `FormSheet` + `ConfirmDialog` + `Sonner` toast.
