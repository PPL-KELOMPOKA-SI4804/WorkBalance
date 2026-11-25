# UI/UX & Brand Identity Design System (DESIGN.md): WorkBalance

**Versi Dokumen:** 3.1 (Tanggal Teks Indonesia, Tabel Detail Resizable, Animasi Hover Light/Dark & Data Perusahaan Menengah)  
**Tanggal:** 25 November 2026  
**Mode Permukaan:** `Operate` (Enterprise Workforce & SDG 8 Decision Support System)  
**Referensi Produk & Teknis:** `PRD.md` & `ARCHITECTURE.md`  
**Tagline Merek:** "Decent Work, Better Life"

---

## 1. Filosofi Visual & Batasan Mutlak (Guardrails)

Dokumen ini menjadi satu-satunya sumber kebenaran (*single source of truth*) untuk seluruh implementasi frontend **WorkBalance** dengan **React 19**, **Tailwind CSS v4 (OKLCH)**, **`shadcn/ui` (Radix Primitives)**, **Recharts**, **TanStack Table v9**, dan **`motion/react`**.

### 1.1 Prinsip Estetika ("Calm Enterprise Precision x HRDashboard Craft")
WorkBalance mengadopsi arsitektur visual **HRDashboard (`Home - V1`)** yang memadukan keteraturan ruang kerja modern dengan identitas warna **Biru WorkBalance (`#0284C7`)** dan disiplin operasional SDG 8:

- **Aturan Distribusi Warna 90 / 10 (Anti-Slop):**
  - **90% permukaan adalah lapisan netral terkalibrasi** (kanvas utama `#FAFAFA` di Light atau *deep navy-slate* `#12151E` di Dark, serta kartu & sidebar putih `#FFFFFF` di Light atau `#1A1F2C` yang sedikit lebih terang di Dark).
  - **10% warna merek & semantik** digunakan secara disiplin untuk tombol hero `Dashboard` di sidebar, link & fokus aktif (`#0284C7`), indikator status, dan seri grafik.
  - **Tombol CTA Kontras Tinggi (`Button variant="cta"`):** Menggunakan `bg-foreground text-background` (obsidian gelap pada Light Mode, putih bersih pada Dark Mode, rasio kontras `> 16:1`) untuk tombol aksi utama (`+ Tambah ...`, `Simpan`, `Hitung Ulang`, `Catat Log`, `Masuk`).
- **Light & Deep Navy-Slate Dark Themes dengan Hover Taktil:**
  - Tema gelap membangun kedalaman halus lewat tangga permukaan (`--background` `#12151E` < `--card`/`--sidebar` `#1A1F2C` < `--popover` `#212737` < `--muted` `#232A3B`), dengan seluruh pasangan warna termasuk permukaan hover terverifikasi **WCAG AA+** (`>= 4.5:1` teks, `>= 3:1` grafik).
  - Token hover khusus (`--hover-surface`, `--hover-surface-strong`, `--hover-border`) menjamin umpan balik hover yang jelas dan memuaskan pada **Light Mode maupun Dark Mode**, disertai mikro-animasi `150–180ms cubic-bezier(0.22, 1, 0.36, 1)` (strip kiri biru pada baris tabel & menu, *micro-lift* tombol/kartu, serta aksen ikon sirkular), tetap menghormati `prefers-reduced-motion`.
  - Kunjungan pertama mengikuti preferensi OS (`prefers-color-scheme`) tanpa FOUC (script inline blocking di `<head>` `index.html`), lalu persisten di `localStorage` (`wb_theme`) melalui **`ThemeSwitch` di header bagian atas** (`AppShell` & pojok kanan atas `LoginPage`).
- **Deklarasi Elevasi Tunggal:**
  - Permukaan statis (Hero Bento, kartu KPI, kartu tabel, panel formulir) memakai **`1px` hairline border (`border-border`) dan `rounded-2xl`** tanpa bayangan kabur lebar.
  - Bayangan (*shadow*) dicadangkan eksklusif untuk lapisan mengambang dan umpan balik hover ringan di mode terang, serta dimatikan (`dark:shadow-none`) di mode gelap.
- **Privasi Visual Survei (Mutlak NFR-02):**
  - Antarmuka `manager` dan `admin` **dilarang keras** merender tabel atau daftar komentar/skor survei per individu. Seluruh visualisasi survei wajib berupa agregat departemen (`AVG` & `COUNT`) dan metadata survei.
- **Non-Punitive & Zero Em Dash Copy:**
  - Hindari terminologi penghakiman individu (*"Kinerja Buruk"*, *"Pegawai Bermasalah"*). Gunakan bahasa pendukung keputusan: *"Risiko Beban Tinggi"*, *"Perlu Redistribusi Tugas"*, *"Perlu Perhatian"*, *"Prioritas Tindakan"*.
  - **Zero Em Dash (`U+2014`):** Dilarang menggunakan em dash pada judul tab, label UI, opsi dropdown, komentar kode, maupun pesan rekomendasi backend. En dash (`–`, `U+2013`) tetap diperbolehkan pada rentang angka/tanggal (mis. `1–5`, `16–22 November 2026`).
- **Strict Scope Boundary:** Tidak ada Payroll, Recruitment, Time Off/QR Attendance, Billing, maupun Google/Apple OAuth (`AGENTS.md`).

---

## 2. Brand Identity & Komponen `BrandLogo`

### 2.1 Anatomi Logo
Logo **WorkBalance** terdiri atas tiga pilar vertikal berujung membulat (*capsule bars*) yang disatukan satu garis lengkung (*arc*):
- **Pilar Kiri (`var(--brand-blue)`):** Struktur tugas dan profesionalisme kerja.
- **Pilar Tengah (`var(--chart-2)`, tertinggi):** Kesejahteraan, kesehatan, dan pertumbuhan berkelanjutan (SDG 8).
- **Pilar Kanan (`var(--chart-3)`):** Kewaspadaan dini dan dinamika beban kerja.
- **Lengkungan Penyeimbang (`currentColor` / `text-foreground`, atau `text-white` saat `inverted`):** Titik tumpu keseimbangan yang beradaptasi otomatis pada Light, Dark, maupun di atas foto gelap Login.

### 2.2 Varian `BrandLogo` (`src/components/workbalance/BrandLogo.jsx`)

| Varian | Ukuran Simbol & Wordmark | Tagline / Prop | Lokasi Penggunaan |
| :--- | :--- | :--- | :--- |
| `mark` | Simbol `28px` | Tidak ada | Sidebar ciut (`w-[72px]`), layar verifikasi sesi. |
| `horizontal` | Simbol `32px` + wordmark `20px` bold | Tidak ada | Header Sidebar (expanded), Sheet navigasi mobile, Login mobile. |
| `lockup` | Simbol `44px` + wordmark `28px` bold | `Decent Work, Better Life` + prop `inverted` | Panel foto editorial kiri Login desktop (`inverted={true}`). |

Aset statis lokal (100% *offline-safe*): [favicon.svg](file:///c:/Kuliah/PPL/WorkBalance/frontend/public/favicon.svg), [workbalance_horizontal_logo.svg](file:///c:/Kuliah/PPL/WorkBalance/frontend/public/assets/workbalance_horizontal_logo.svg), dan foto editorial [login-hero.jpg](file:///c:/Kuliah/PPL/WorkBalance/frontend/public/assets/login-hero.jpg).

---

## 3. Design Tokens (Tailwind CSS v4 & OKLCH Semantic Palette)

Seluruh komponen **WAJIB** menggunakan token semantik CSS (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-hover-surface`, `bg-hover-surface-strong`, `border-hover-border`, `text-success`, `bg-warning-subtle`, `border-danger-border`, `bg-hero-primary`, dst.). **DILARANG** menulis warna hex hardcoded atau kelas palet mentah (`emerald-*`, `amber-*`, `rose-*`, `sky-*`, `slate-*`, `gray-*`) di halaman maupun komponen domain.

### 3.1 Lapisan Permukaan & Hover Light vs Dark (`src/index.css`)

| Token Semantik | Light (OKLCH / Ref) | Dark (OKLCH / Ref) | Peran |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.985 0.002 250)` (`#FAFAFA`) | `oklch(0.172 0.018 262)` (`#12151E`) | Kanvas utama halaman |
| `--sidebar` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.218 0.022 262)` (`#1A1F2C`) | Sidebar kiri (`Home - V1`) |
| `--card` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.218 0.022 262)` (`#1A1F2C`) | Hero Bento, kartu KPI, tabel, panel |
| `--popover` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.246 0.024 262)` (`#212737`) | Dropdown, kalender, popover |
| `--muted` | `oklch(0.968 0.004 250)` (`#F7FAFC`) | `oklch(0.264 0.024 262)` (`#232A3B`) | Strip header tabel, lingkaran ikon KPI |
| `--hover-surface` | `oklch(0.924 0.018 244)` | `oklch(0.304 0.032 254)` | Latar hover baris tabel, menu sidebar, dropdown (`5.8:1`–`14.0:1` WCAG AA+) |
| `--hover-surface-strong` | `oklch(0.888 0.026 242)` | `oklch(0.348 0.038 250)` | Latar hover tombol outline/ghost, paginasi, aksi baris (`10.0:1`–`12.5:1`) |
| `--hover-border` | `oklch(0.755 0.058 240)` | `oklch(0.475 0.065 245)` | Bingkai aksen hover pada kartu, tombol outline, dan input/picker |
| `--foreground` | `oklch(0.215 0.028 260)` (`#1A202C`) | `oklch(0.958 0.006 250)` (`#F5F7FA`) | Tipografi utama (`> 15:1`) & latar `variant="cta"` |
| `--muted-foreground` | `oklch(0.455 0.022 256)` | `oklch(0.742 0.018 256)` | Label sekunder & metadata (`> 6.5:1`) |
| `--hero-primary` | `oklch(0.538 0.150 238)` (`#0284C7`) | `oklch(0.538 0.152 238)` (`#0284C7`) | Tombol hero pill `Dashboard` sidebar (teks putih `4.77:1`) |
| `--primary` | `oklch(0.538 0.150 238)` (`#0284C7`) | `oklch(0.715 0.136 237)` | Fokus, tautan aktif, strip hover baris, handle resize aktif |
| `--border` | `oklch(0.918 0.007 250)` | `oklch(0.305 0.022 262)` | Garis hairline `1px` kartu & pembagi 2×2 Hero Bento |

### 3.2 Token Status Semantik & `<StatusBadge />`

Empat grup nada (`success`, `warning`, `danger`, `info`) masing-masing menyediakan `-foreground` (`text-*`), `-subtle` (`bg-*-subtle`), `-border` (`border-*-border`), dan `-solid` (`bg-*-solid`), seluruhnya terverifikasi `>= 4.8:1` WCAG AA+ di mode terang dan gelap:
- **`success`:** `low`, `good`, `approved`, `completed`, `resolved`, `active`
- **`warning`:** `medium`, `needs_attention`, `pending`, `in_progress`
- **`danger`:** `high`, `override`, `action_priority`, `rejected`, `severe`
- **`info`:** `open`, `enrolled`, `planned`, `todo`
- **`neutral`:** `cancelled`, `inactive`

### 3.3 Tipografi Self-Hosted, Format Tanggal Teks Indonesia & Tabel Detail Resizable

- **UI Sans & Heading (`@fontsource-variable/manrope`):** Font utama untuk seluruh heading (`font-bold tracking-[-0.025em]`), label, isi tabel, dan angka metrik (`tabular-nums`).
- **Slot Kode (`@fontsource-variable/dm-sans`, Regular `400`):** Diterapkan pada `--font-mono` khusus untuk kode pegawai (`EMP-001`), kode departemen (`ENG`, `OPS`, `HRD`), dan shortcut keycap (`Ctrl K`). Tanpa Google Fonts CDN dan tanpa font monospace lawas.
- **Lantai Tipografi & Aksesibilitas:** Minimal `text-xs` (`12px`), `0` `italic`, `leading-5` pada item menu sidebar agar descender (`g`, `p`, `y`) tidak terpotong, dan `text-wrap: balance` pada `h1–h4`.
- **Judul Tab Dinamis (`useDocumentTitle`):** Setiap rute memperbarui `document.title` menjadi `{Judul Halaman} | WorkBalance` (default `WorkBalance`).
- **Sistem Tanggal Teks Indonesia (`src/lib/format.js`):**
  - Seluruh tampilan tanggal memakai nama bulan Indonesia penuh: **`20 November 2026`** (`formatDate`), **`20 November 2026, 14:30`** (`formatDateTime`), **`November 2026`** (`formatMonth`), dan **`16–22 November 2026`** / **`30 November – 6 Desember 2026`** (`formatWeek`), dengan `toISODateLocal()` untuk mencegah pergeseran timezone WIB.
  - Seluruh input tanggal/bulan/minggu memakai `DatePicker`, `MonthPicker`, dan `WeekPicker` (shadcn `Calendar` + `Popover`, `react-day-picker` + `date-fns` locale `id`), sementara payload API tetap ISO (`YYYY-MM-DD`, `YYYY-MM`, `YYYY-Www`).
- **Tabel Detail Sesuai Database + Hold-and-Drag Column Resizing (`DataTable.jsx`):**
  - Setiap tabel dikemas dalam satu kartu `rounded-2xl border bg-card` dengan judul + jumlah di kiri atas, tombol **Create `variant="cta"`** di kanan atas, baris pencarian + filter sebaris, strip header `bg-muted/85 rounded-xl`, dan **paginasi bernomor `< 1 2 3 ... N >`** + `Menampilkan X–Y dari Z`.
  - Seluruh tabel menampilkan **kolom detail sesuai skema basis data** (terkalibrasi `size`, `minSize`, `maxSize`, dengan `overflow-x-auto` dan `truncate` + `title` yang bersih).
  - **Hold-and-Drag Resizing (TanStack Table v9 `columnSizingFeature` + `columnResizingFeature`):** Garis pemisah vertikal di antara setiap header kolom dapat ditahan & digeser (`cursor-col-resize`, sorotan biru `--primary`) untuk mempersempit atau memperpanjang lebar kolom secara *real-time*, klik 2× untuk reset kolom tunggal, dan tombol `Reset Lebar` otomatis muncul bila ada kolom yang diubah.
  - Klik atau `Enter`/`Space` pada baris membuka **Detail `FormSheet`** bergaya drawer `21. Add New Profile`; tombol aksi baris `RowActionsMenu` (`⋯`) memiliki lebar tetap (`enableResizing: false`).
  - Seluruh tombol refresh manual dihapus; data disegarkan otomatis saat mutasi dan saat tab kembali aktif (`useRefetchOnFocus`).

---

## 4. Arsitektur App Shell (`Home - V1`), Data Demo & Katalog Komponen

- **Sidebar Collapsible (`w-64` expanded / `w-[72px]` collapsed):** Header `BrandLogo` + tombol lipat `<<`, **Tombol Hero `Dashboard`** biru (`--hero-primary`), **Grup Accordion Lipat-Buka** dengan hover latar `--hover-surface` & strip kiri biru, serta footer `PP 35/2021 · 40j + maks 18j`.
- **Sticky Top Header (`h-[68px]`):** Kiri berisi pemicu menu mobile, bilah pencarian global `Ctrl K`, serta breadcrumb & judul halaman (`H1`); kanan berisi isyarat kontekstual (seperti `NFR-02` pada Survei), **`ThemeSwitch`**, dan menu profil pengguna.
- **Komposisi Dasbor (`15. Home - V1`):**
  1. Sapaan (`Halo, {Nama}`) + meta periode/identitas & filter ringkas.
  2. **`<HeroBentoCard />`:** 5 kolom kiri berupa grid KPI 2×2 bersekat *hairline* dengan hover sel halus & animasi ikon sirkular, 7 kolom kanan berupa grafik terintegrasi (`PerformanceLineChart` / `WorkHoursBarChart`).
  3. **Baris Bawah 8/4:** 8 kolom kiri `DataTable` detail resizable, 4 kolom kanan `DecentWorkDonutChart` (6 dimensi + Survei Agregat NFR-02) atau `Profil Beban Kerja` + `Aksi Cepat`.
- **Dataset Perusahaan Menengah (`MidSizeCompanySeeder`):** Menyediakan data realistis tingkat perusahaan menengah (10 departemen, 70 pegawai, 28 jabatan, 4 jenis kepegawaian, 42 tugas, 78 penugasan, ~500 log kerja, lembur/cuti termasuk 5 kasus Override PP No. 35/2021, 10 pelatihan, 4 survei bulanan + ~180 respons, dan 18 masalah kerja) secara idempoten di atas akun uji cepat `DatabaseSeeder`.
- **Komponen Domain (`src/components/workbalance/`):** `BrandLogo`, `ThemeSwitch`, `AnimatedNumber`, `HeroBentoCard`, `KpiStatCard`, `StatusBadge`, `DataTable`, `RowActionsMenu`, `DatePicker`, `MonthPicker`, `WeekPicker`, `FormSheet`, `ConfirmDialog`, `CommandMenu`, `Charts` (`DecentWorkDonutChart`, `WorkHoursBarChart`, `WorkloadTrendAreaChart`, `PerformanceLineChart`).
