# UI/UX & Brand Identity Design System (DESIGN.md): WorkBalance

**Versi Dokumen:** 2.2 (Composed Light/Dark Themes, Calm Rows & DD-MM-YYYY Date System)  
**Tanggal:** 22 November 2026  
**Mode Permukaan:** `Operate` (Enterprise Workforce & SDG 8 Decision Support System)  
**Referensi Produk & Teknis:** `PRD.md` & `ARCHITECTURE.md`  
**Tagline Merek:** "Decent Work, Better Life"

---

## 1. Filosofi Visual & Batasan Mutlak (Guardrails)

Dokumen ini menjadi satu-satunya sumber kebenaran (*single source of truth*) untuk seluruh implementasi frontend **WorkBalance** dengan **React 19**, **Tailwind CSS v4 (OKLCH)**, **`shadcn/ui` (Radix Primitives)**, **Recharts**, dan **TanStack Table**.

### 1.1 Prinsip Estetika ("Calm Enterprise Precision")
WorkBalance adalah alat kerja harian (*Operate mode*) bagi Pegawai, Manajer, dan Admin HR, bukan halaman brosur. Kualitas visual hadir lewat **presisi, ketenangan, konsistensi, dan hierarki yang jujur**:

- **Aturan Distribusi Warna 90 / 10 (Anti-Slop):**
  - **90% permukaan adalah lapisan netral terkalibrasi** (sidebar netral terpisah, kanvas konten utama, kartu berbingkai hairline `1px`).
  - **10% warna merek & semantik** digunakan hanya untuk aksi utama (CTA), item navigasi aktif, titik/badge indikator status, dan seri data grafik.
  - **DILARANG** memenuhi kartu KPI dengan kotak ikon persegi pastel mencolok atau menumpuk kartu di dalam kartu (*nested cards*).
- **Light & Composed Dark Themes:**
  - Tema gelap disusun secara sadar lewat anak tangga kecerahan permukaan (`sidebar < background < card < popover`) tanpa inversi mekanis, dengan rasio kontras WCAG AA+ terverifikasi (`>= 4.5:1` teks, `>= 3:1` seri grafik).
  - Kunjungan pertama mengikuti preferensi OS (`prefers-color-scheme`) tanpa FOUC (script inline blocking di `<head>` `index.html`), lalu persisten di `localStorage` (`wb_theme`) saat pengguna menekan `ThemeSwitch` di header atau halaman Login.
- **Deklarasi Elevasi Tunggal:**
  - Permukaan statis (kartu, tabel, toolbar) memakai **`1px` hairline border (`border-border`) tanpa bayangan kabur lebar**.
  - Bayangan (*shadow*) dicadangkan eksklusif untuk lapisan mengambang di mode terang dan dimatikan (`dark:shadow-none`) di mode gelap (digantikan ring border).
- **Privasi Visual Survei (Mutlak NFR-02):**
  - Antarmuka `manager` dan `admin` **dilarang keras** merender tabel atau daftar komentar/skor survei per individu. Seluruh visualisasi survei wajib berupa agregat departemen (`AVG` & `COUNT`).
- **Non-Punitive & Zero Em Dash Copy:**
  - Hindari terminologi penghakiman individu (*"Kinerja Buruk"*, *"Pegawai Bermasalah"*). Gunakan bahasa pendukung keputusan: *"Risiko Beban Tinggi"*, *"Perlu Redistribusi Tugas"*, *"Perlu Perhatian"*, *"Prioritas Tindakan"*.
  - **Zero Em Dash (`U+2014`):** Dilarang menggunakan em dash pada judul tab, label UI, opsi dropdown, komentar kode, maupun pesan rekomendasi backend. En dash (`–`, `U+2013`) tetap diperbolehkan pada rentang angka (mis. `1–5`, `1–10 dari 40`).

---

## 2. Brand Identity & Komponen `BrandLogo`

### 2.1 Anatomi Logo
Logo **WorkBalance** terdiri atas tiga pilar vertikal berujung membulat (*capsule bars*) yang disatukan satu garis lengkung (*arc*):
- **Pilar Kiri (`var(--brand-blue)`):** Struktur tugas dan profesionalisme kerja.
- **Pilar Tengah (`var(--chart-2)`, tertinggi):** Kesejahteraan, kesehatan, dan pertumbuhan berkelanjutan (SDG 8).
- **Pilar Kanan (`var(--chart-3)`):** Kewaspadaan dini dan dinamika beban kerja.
- **Lengkungan Penyeimbang (`currentColor` / `text-foreground`):** Titik tumpu keseimbangan yang otomatis beradaptasi pada mode terang dan gelap.

### 2.2 Varian `BrandLogo` (`src/components/workbalance/BrandLogo.jsx`)

| Varian | Ukuran Simbol & Wordmark | Tagline | Lokasi Penggunaan |
| :--- | :--- | :--- | :--- |
| `mark` | Simbol `28px` | Tidak ada | Sidebar ciut (collapsed), layar verifikasi sesi. |
| `horizontal` | Simbol `32px` + wordmark `21px` bold | Tidak ada | Header Sidebar (expanded), Sheet navigasi mobile, Login mobile. |
| `lockup` | Simbol `44px` + wordmark `28px` bold | `Decent Work, Better Life` (`12px`) | Panel kiri Login desktop. |

Aset statis: [favicon.svg](file:///c:/Kuliah/PPL/WorkBalance/frontend/public/favicon.svg) (sadar `prefers-color-scheme`) dan [workbalance_horizontal_logo.svg](file:///c:/Kuliah/PPL/WorkBalance/frontend/public/assets/workbalance_horizontal_logo.svg) (wordmark diperbesar proporsional untuk penggunaan luar aplikasi).

---

## 3. Design Tokens (Tailwind CSS v4 & OKLCH Semantic Palette)

Seluruh komponen **WAJIB** menggunakan token semantik CSS (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-success`, `bg-warning-subtle`, `border-danger-border`, dst.). **DILARANG** menulis warna hex hardcoded atau kelas palet mentah (`emerald-*`, `amber-*`, `rose-*`, `sky-*`, `slate-*`) di halaman maupun komponen domain.

### 3.1 Lapisan Permukaan Light vs Dark (`src/index.css`)

| Token Semantik | Light (OKLCH) | Dark (OKLCH) | Peran |
| :--- | :--- | :--- | :--- |
| `--sidebar` | `oklch(0.974 0.005 247)` | `oklch(0.142 0.013 256)` | Lapisan sidebar (tertanam di dark mode) |
| `--background` | `oklch(0.988 0.003 247)` | `oklch(0.160 0.014 256)` | Kanvas konten utama |
| `--card` | `oklch(1 0 0)` | `oklch(0.200 0.016 256)` | Kartu data, tabel, panel formulir |
| `--popover` | `oklch(1 0 0)` | `oklch(0.228 0.017 256)` | Dropdown, popover kalender, sheet, dialog |
| `--foreground` | `oklch(0.205 0.032 256)` | `oklch(0.945 0.006 247)` | Teks utama (`> 15:1` di kedua tema) |
| `--muted-foreground` | `oklch(0.425 0.024 256)` | `oklch(0.730 0.018 256)` | Teks sekunder (`> 7.5:1` di kedua tema) |
| `--primary` | `oklch(0.542 0.148 238)` | `oklch(0.705 0.135 237)` | Aksi utama & status aktif |
| `--primary-foreground` | `oklch(0.994 0.002 247)` | `oklch(0.155 0.020 256)` | Teks tombol primer (`4.7:1` light, `7.6:1` dark) |
| `--brand-blue` | `oklch(0.555 0.148 238)` | `oklch(0.740 0.130 237)` | Kata "Balance" & pilar biru `BrandLogo` |
| `--border` | `oklch(0.902 0.008 247)` | `oklch(0.285 0.016 256)` | Garis pemisah `1px` |

### 3.2 Token Status Semantik & `<StatusBadge />`

Empat grup nada (`success`, `warning`, `danger`, `info`) masing-masing menyediakan `-foreground` (`text-*`), `-subtle` (`bg-*-subtle`), `-border` (`border-*-border`), dan `-solid` (`bg-*-solid`), seluruhnya terverifikasi `>= 4.8:1` WCAG AA+ di mode terang dan gelap:
- **`success`:** `low`, `good`, `approved`, `completed`, `resolved`, `active`
- **`warning`:** `medium`, `needs_attention`, `pending`, `in_progress`
- **`danger`:** `high`, `override`, `action_priority`, `rejected`, `severe`
- **`info`:** `open`, `enrolled`, `planned`, `todo`
- **`neutral`:** `cancelled`, `inactive`

### 3.3 Tipografi Self-Hosted, Format Tanggal & Anggaran Baris

- **UI Sans (`@fontsource-variable/plus-jakarta-sans`):** Dipakai untuk seluruh heading, label, isi tabel, dan angka metrik (`tabular-nums`).
- **Slot Kode (`@fontsource-variable/dm-sans`, Regular `400`):** Menggantikan JetBrains Mono pada `--font-mono` khusus untuk kode pegawai (`EMP-001`), kode departemen (`ENG`, `OPS`, `HRD`), dan shortcut keycap (`Ctrl K`). Tanpa CDN Google Fonts.
- **Lantai Tipografi & Aksesibilitas:** Minimal `text-xs` (`12px`), `0` `italic`, `leading-5` pada item menu sidebar agar descender (`g`, `p`, `y`) tidak terpotong, dan `text-wrap: balance` pada `h1–h4`.
- **Judul Tab Dinamis (`useDocumentTitle`):** Setiap rute memperbarui `document.title` menjadi `{Judul Halaman} | WorkBalance` (default `WorkBalance`).
- **Sistem Tanggal `DD-MM-YYYY` (`src/lib/format.js`):**
  - Seluruh tanggal ditampilkan `DD-MM-YYYY` (timestamp `DD-MM-YYYY HH:mm`, bulan `MM-YYYY`, minggu `DD-MM-YYYY s.d. DD-MM-YYYY`) dengan `toISODateLocal()` untuk mencegah pergeseran tanggal UTC pukul `00.00–07.00` WIB.
  - Seluruh input tanggal/bulan/minggu memakai `DatePicker`, `MonthPicker`, dan `WeekPicker` (shadcn `Calendar` + `Popover`, `react-day-picker` + `date-fns` locale `id`), sementara payload API tetap ISO (`YYYY-MM-DD`, `YYYY-MM`, `YYYY-Www`).
- **Calm Rows & Penempatan Aksi:**
  - Tombol **Create** (`Tambah ...`, `Buat Survei`, `Catat Work Log`, `Laporkan Masalah`, `Hitung Ulang`) ditempatkan di **pojok kanan atas `DataTable`** (`actionsSlot`), bukan di header `AppShell`.
  - Seluruh tombol refresh manual (`RefreshCw`) dihapus; data disegarkan otomatis saat mutasi dan saat tab kembali aktif (`useRefetchOnFocus`). Tombol "Coba Lagi" pada state error tetap dipertahankan tanpa ikon refresh.
  - Setiap tabel maksimal **4 kolom data 1 baris** + 1 kolom `RowActionsMenu` (`⋯` untuk Ubah/Hapus); klik atau tekan `Enter`/`Space` pada baris membuka sheet Detail (`FormSheet`).

---

## 4. Arsitektur App Shell & Katalog Komponen

- **Sidebar (`w-60` expanded / `w-[68px]` collapsed):** `BrandLogo` (`horizontal` / `mark`), 4 grup semantik, indikator aktif `layoutId`, dan footer ringkas `PP 35/2021 · 40j + maks 18j`.
- **Sticky Top Header (`h-14`):** Kiri berisi toggle sidebar + breadcrumb induk + `H1`; kanan berisi pencarian cepat `Ctrl K`, `ThemeSwitch` (mode terang/gelap), isyarat kontekstual (seperti `NFR-02` pada Survei), dan menu profil pengguna.
- **Komponen Domain (`src/components/workbalance/`):** `BrandLogo`, `ThemeSwitch`, `AnimatedNumber`, `KpiStatCard`, `StatusBadge`, `DataTable`, `RowActionsMenu`, `DatePicker`, `MonthPicker`, `WeekPicker`, `FormSheet`, `ConfirmDialog`, `CommandMenu`, `Charts`.
