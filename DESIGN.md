# UI/UX & Brand Identity Design System (DESIGN.md): WorkBalance

**Versi Dokumen:** 3.0 (HRDashboard Visual Overhaul, Manrope + DM Sans, Deep Navy-Slate Dark & Bento Architecture)  
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
- **Light & Deep Navy-Slate Dark Themes:**
  - Tema gelap membangun kedalaman halus lewat tangga permukaan (`--background` `#12151E` < `--card`/`--sidebar` `#1A1F2C` < `--popover` `#212737` < `--muted` `#232A3B`), dengan seluruh 22 pasangan warna terverifikasi **WCAG AA+** (`>= 4.5:1` teks, `>= 3:1` grafik).
  - Kunjungan pertama mengikuti preferensi OS (`prefers-color-scheme`) tanpa FOUC (script inline blocking di `<head>` `index.html`), lalu persisten di `localStorage` (`wb_theme`) melalui **`ThemeSwitch` di header bagian atas** (`AppShell` & pojok kanan atas `LoginPage`).
- **Deklarasi Elevasi Tunggal:**
  - Permukaan statis (Hero Bento, kartu KPI, kartu tabel, panel formulir) memakai **`1px` hairline border (`border-border`) dan `rounded-2xl`** tanpa bayangan kabur lebar.
  - Bayangan (*shadow*) dicadangkan eksklusif untuk lapisan mengambang di mode terang dan dimatikan (`dark:shadow-none`) di mode gelap.
- **Privasi Visual Survei (Mutlak NFR-02):**
  - Antarmuka `manager` dan `admin` **dilarang keras** merender tabel atau daftar komentar/skor survei per individu. Seluruh visualisasi survei wajib berupa agregat departemen (`AVG` & `COUNT`).
- **Non-Punitive & Zero Em Dash Copy:**
  - Hindari terminologi penghakiman individu (*"Kinerja Buruk"*, *"Pegawai Bermasalah"*). Gunakan bahasa pendukung keputusan: *"Risiko Beban Tinggi"*, *"Perlu Redistribusi Tugas"*, *"Perlu Perhatian"*, *"Prioritas Tindakan"*.
  - **Zero Em Dash (`U+2014`):** Dilarang menggunakan em dash pada judul tab, label UI, opsi dropdown, komentar kode, maupun pesan rekomendasi backend. En dash (`–`, `U+2013`) tetap diperbolehkan pada rentang angka (mis. `1–5`, `1–10 dari 40`).
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

Seluruh komponen **WAJIB** menggunakan token semantik CSS (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-success`, `bg-warning-subtle`, `border-danger-border`, `bg-hero-primary`, dst.). **DILARANG** menulis warna hex hardcoded atau kelas palet mentah (`emerald-*`, `amber-*`, `rose-*`, `sky-*`, `slate-*`, `gray-*`) di halaman maupun komponen domain.

### 3.1 Lapisan Permukaan Light vs Dark (`src/index.css`)

| Token Semantik | Light (OKLCH / Ref) | Dark (OKLCH / Ref) | Peran |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.985 0.002 250)` (`#FAFAFA`) | `oklch(0.172 0.018 262)` (`#12151E`) | Kanvas utama halaman |
| `--sidebar` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.218 0.022 262)` (`#1A1F2C`) | Sidebar kiri (`Home - V1`) |
| `--card` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.218 0.022 262)` (`#1A1F2C`) | Hero Bento, kartu KPI, tabel, panel |
| `--popover` | `oklch(1 0 0)` (`#FFFFFF`) | `oklch(0.246 0.024 262)` (`#212737`) | Dropdown, kalender, popover |
| `--muted` | `oklch(0.968 0.004 250)` (`#F7FAFC`) | `oklch(0.264 0.024 262)` (`#232A3B`) | Strip header tabel, item aktif submenu, lingkaran ikon KPI |
| `--foreground` | `oklch(0.215 0.028 260)` (`#1A202C`) | `oklch(0.958 0.006 250)` (`#F5F7FA`) | Tipografi utama (`> 15:1` di kedua tema) & latar `variant="cta"` |
| `--muted-foreground` | `oklch(0.455 0.022 256)` | `oklch(0.742 0.018 256)` | Label sekunder & metadata (`> 6.5:1` di kedua tema) |
| `--hero-primary` | `oklch(0.538 0.150 238)` (`#0284C7`) | `oklch(0.538 0.152 238)` (`#0284C7`) | Tombol hero pill `Dashboard` sidebar (teks putih `4.77:1`) |
| `--primary` | `oklch(0.538 0.150 238)` (`#0284C7`) | `oklch(0.715 0.136 237)` | Fokus, tautan aktif, ikon aksen (`7.03:1` di dark card) |
| `--brand-blue` | `oklch(0.542 0.148 238)` | `oklch(0.745 0.132 237)` | Kata "Balance" & pilar biru `BrandLogo` |
| `--border` | `oklch(0.918 0.007 250)` | `oklch(0.305 0.022 262)` | Garis hairline `1px` kartu & pembagi 2×2 Hero Bento |

### 3.2 Token Status Semantik & `<StatusBadge />`

Empat grup nada (`success`, `warning`, `danger`, `info`) masing-masing menyediakan `-foreground` (`text-*`), `-subtle` (`bg-*-subtle`), `-border` (`border-*-border`), dan `-solid` (`bg-*-solid`), seluruhnya terverifikasi `>= 4.8:1` WCAG AA+ di mode terang dan gelap:
- **`success`:** `low`, `good`, `approved`, `completed`, `resolved`, `active`
- **`warning`:** `medium`, `needs_attention`, `pending`, `in_progress`
- **`danger`:** `high`, `override`, `action_priority`, `rejected`, `severe`
- **`info`:** `open`, `enrolled`, `planned`, `todo`
- **`neutral`:** `cancelled`, `inactive`

### 3.3 Tipografi Self-Hosted, Format Tanggal & Anggaran Baris

- **UI Sans & Heading (`@fontsource-variable/manrope`):** Font utama untuk seluruh heading (`font-bold tracking-[-0.025em]`), label, isi tabel, dan angka metrik (`tabular-nums`).
- **Slot Kode (`@fontsource-variable/dm-sans`, Regular `400`):** Diterapkan pada `--font-mono` khusus untuk kode pegawai (`EMP-001`), kode departemen (`ENG`, `OPS`, `HRD`), dan shortcut keycap (`Ctrl K`). Tanpa Google Fonts CDN dan tanpa JetBrains Mono.
- **Lantai Tipografi & Aksesibilitas:** Minimal `text-xs` (`12px`), `0` `italic`, `leading-5` pada item menu sidebar agar descender (`g`, `p`, `y`) tidak terpotong, dan `text-wrap: balance` pada `h1–h4`.
- **Judul Tab Dinamis (`useDocumentTitle`):** Setiap rute memperbarui `document.title` menjadi `{Judul Halaman} | WorkBalance` (default `WorkBalance`).
- **Sistem Tanggal `DD-MM-YYYY` (`src/lib/format.js`):**
  - Seluruh tanggal ditampilkan `DD-MM-YYYY` (timestamp `DD-MM-YYYY HH:mm`, bulan `MM-YYYY`, minggu `DD-MM-YYYY s.d. DD-MM-YYYY`) dengan `toISODateLocal()` untuk mencegah pergeseran tanggal UTC pukul `00.00–07.00` WIB.
  - Seluruh input tanggal/bulan/minggu memakai `DatePicker`, `MonthPicker`, dan `WeekPicker` (shadcn `Calendar` + `Popover`, `react-day-picker` + `date-fns` locale `id`), sementara payload API tetap ISO (`YYYY-MM-DD`, `YYYY-MM`, `YYYY-Www`).
- **Hybrid HRDashboard Table x Calm Rows:**
  - Setiap tabel dikemas dalam satu kartu `rounded-2xl border bg-card` dengan judul + jumlah di kiri atas, tombol **Create `variant="cta"`** di kanan atas, baris pencarian + filter sebaris, strip header `bg-muted/75 rounded-xl`, dan **paginasi bernomor `< 1 2 3 ... N >`** + `Menampilkan X–Y dari Z`.
  - Isi baris tetap menganut **Calm Rows**: maksimal **4 kolom data 1 baris** + 1 kolom `RowActionsMenu` (`⋯`); klik atau `Enter`/`Space` pada baris membuka **Detail `FormSheet`** bergaya drawer `21. Add New Profile`.
  - Seluruh tombol refresh manual (`RefreshCw`) dihapus; data disegarkan otomatis saat mutasi dan saat tab kembali aktif (`useRefetchOnFocus`).

---

## 4. Arsitektur App Shell (`Home - V1`) & Katalog Komponen

- **Sidebar Collapsible (`w-64` expanded / `w-[72px]` collapsed):**
  - Header sidebar berisi `BrandLogo` (`horizontal` / `mark`) + tombol lipat `<<` di sisi kanan.
  - **Tombol Hero `Dashboard`:** Pil penuh berwarna `--hero-primary` (`#0284C7`, `rounded-xl`) menuju `Kondisi Kerja Tim` (Admin/Manajer) atau `Beranda` (Pegawai).
  - **Grup Accordion Lipat-Buka:** Grup rute aktif otomatis terbuka; saat sidebar ciut, ikon per modul tampil dengan `Tooltip` deskriptif.
  - Footer sidebar tenang: `PP 35/2021 · 40j + maks 18j`.
- **Sticky Top Header (`h-[68px]`):**
  - Kiri: pemicu menu mobile, tombol pencarian global lebar bergaya input pill (`Cari modul atau halaman...` + `Ctrl K`), serta breadcrumb & judul halaman (`H1`).
  - Kanan: isyarat kontekstual (seperti `NFR-02` pada halaman Survei), **`ThemeSwitch`**, dan menu profil pengguna (`Keluar`).
- **Komposisi Dasbor (`15. Home - V1`):**
  1. Sapaan (`Halo, {Nama}`) + meta periode/identitas & filter ringkas.
  2. **`<HeroBentoCard />`:** 5 kolom kiri berupa grid KPI 2×2 bersekat *hairline* (badge ikon sirkular `bg-muted`, angka `30px` Manrope bold, `StatusBadge`), 7 kolom kanan berupa grafik terintegrasi (`PerformanceLineChart` untuk Manajer/Admin, `WorkHoursBarChart` untuk Pegawai).
  3. **Baris Bawah 8/4:** 8 kolom kiri `DataTable` prioritas/penugasan aktif, 4 kolom kanan `DecentWorkDonutChart` (6 dimensi + Survei Agregat NFR-02) atau `Profil Beban Kerja` + `Aksi Cepat`.
- **Komponen Domain (`src/components/workbalance/`):** `BrandLogo`, `ThemeSwitch`, `AnimatedNumber`, `HeroBentoCard`, `KpiStatCard`, `StatusBadge`, `DataTable`, `RowActionsMenu`, `DatePicker`, `MonthPicker`, `WeekPicker`, `FormSheet`, `ConfirmDialog`, `CommandMenu`, `Charts` (`DecentWorkDonutChart`, `WorkHoursBarChart`, `WorkloadTrendAreaChart`, `PerformanceLineChart`).
