# UI/UX & Brand Identity Design System (DESIGN.md): WorkBalance

**Versi Dokumen:** 1.0
**Tanggal:** 17 November 2026
**Referensi Produk & Teknis:** `PRD.md` & `ARCHITECTURE.md`
**Tagline Merek:** _"Decent Work, Better Life"_

---

## 1. Tujuan & Batasan Desain (_Design Scope & Guardrails_)

Dokumen ini menjadi satu-satunya sumber kebenaran (_single source of truth_) untuk implementasi antarmuka pengguna (_frontend_) **WorkBalance** menggunakan **React**, **Tailwind CSS**, dan **Recharts**.

> **Batasan Mutlak UI/UX (Guardrails):**
>
> - **Estetika Klinis, Tenang, & Terstruktur:** Menggunakan kanvas terang (_light mode_ utama) dengan kartu putih bersih (`#FFFFFF`), sudut membulat lembut, dan ruang negatif yang lega untuk meredam kelelahan visual—selaras dengan nilai _work-life balance_.
> - **Privasi Visual Survei:** Antarmuka Manajer **dilarang** merender tabel atau daftar komentar/skor survei per individu. Seluruh visualisasi survei pada dasbor Manajer wajib berupa metrik agregat departemen.
> - **Non-Punitive Visual Language:** Hindari penggunaan ikon atau label yang menghakimi individu (seperti _badge_ "Kinerja Buruk"). Gunakan terminologi dukungan keputusan seperti _"Beban Tinggi — Perlu Redistribusi"_ atau _"Perlu Perhatian"_.
> - **Fokus Desktop & Tablet Responsif:** Dioptimalkan untuk resolusi desktop (`1280px–1920px`) dengan adaptasi _collapsible sidebar_ untuk layar tablet (`768px–1023px`).

---

## 2. Brand Identity & Aset Logo

### 2.1 Filosofi & Anatomi Logo

Logo **WorkBalance** terdiri atas tiga pilar vertikal berujung membulat (_capsule bars_) yang disatukan oleh satu garis lengkung (_arc_) di bagian tengah:

- **Pilar Kiri (`#0284C7` — Primary Blue):** Merepresentasikan struktur tugas dan profesionalisme kerja.
- **Pilar Tengah (`#10B981` — Success Green, tertinggi):** Merepresentasikan kesejahteraan, kesehatan, dan pertumbuhan berkelanjutan (SDG 8).
- **Pilar Kanan (`#F59E0B` — Accent Orange):** Merepresentasikan energi, kewaspadaan dini, dan dinamika beban kerja.
- **Lengkungan Penyeimbang (`#1E293B` — Slate Dark):** Mengikat ketiga pilar dalam satu titik tumpu keseimbangan (_equilibrium_).

### 2.2 Spesifikasi File & Penempatan Aset

Letakkan seluruh aset vektor di direktori `frontend/public/assets/`:

| Nama File                           | Varian                                        | Rasio / Ukuran              | Lokasi Penggunaan                                                                                                |
| :---------------------------------- | :-------------------------------------------- | :-------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `workbalance_horizontal_logo_2.svg` | Horizontal Lockup (Ikon + Wordmark + Tagline) | `height: 36px` (auto width) | _Header_ Sidebar Utama (kondisi _expanded_), Header Halaman Login, dan Kop Laporan PDF/Cetak.                    |
| `workbalance_logo_2.svg`            | Standalone Symbol / Icon                      | `32px × 32px`               | _Favicon_ browser (`<link rel="icon">`), _Header_ Sidebar saat kondisi _collapsed_, dan _Loading Spinner_ brand. |
| _Dark Variant_ (Inline SVG)         | Putih + Primary Blue                          | `height: 36px`              | Digunakan eksklusif jika ada kontainer berlatar `#1E293B` (Slate Dark).                                          |

- **Aturan Wordmark:** Kata **`Work`** wajib menggunakan warna `#1E293B` (_Slate Dark_) dengan ketebalan `font-bold` (`700`), sedangkan **`Balance`** menggunakan warna `#0284C7` (_Primary Blue_) dengan ketebalan `font-bold` (`700`). _Tagline_ **`Decent Work, Better Life`** ditulis menggunakan `#475569` dengan `letter-spacing: 0.12em`.
- **Clear Space:** Sisakan jarak kosong (_padding_) minimal `12px` di sekeliling logo dari elemen batas kontainer atau garis pemisah.

---

## 3. Design Tokens (Warna, Tipografi & Elevasi)

### 3.1 Palet Warna & Proporsi Visual (WCAG AAA Compliant)

Proporsi distribusi warna pada kanvas antarmuka mengikuti standar merek: **35% Primary Blue**, **35% Success Green**, **15% Accent Orange**, dan **15% Slate Dark** di atas permukaan netral.

```javascript
// Konfigurasi referensi untuk tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0284C7", // Primary Blue (Kontras 7.24:1 vs White)
          "blue-light": "#E0F2FE",
          "blue-dark": "#0369A1",
          green: "#10B981", // Success Green
          "green-light": "#D1FAE5",
          "green-dark": "#047857",
          orange: "#F59E0B", // Accent Orange
          "orange-light": "#FEF3C7",
          "orange-dark": "#B45309",
          slate: "#1E293B", // Slate Dark (Kontras 10.95:1 vs White)
        },
        surface: {
          canvas: "#F8FAFC", // Latar belakang utama halaman
          card: "#FFFFFF", // Latar belakang kartu & tabel
          muted: "#F1F5F9", // Latar belakang input, hover baris, & sub-header
          border: "#E2E8F0", // Garis tepi kartu & pemisah halus
        },
        semantic: {
          danger: "#EF4444", // Risiko Tinggi / Over-limit PP 35/2021
          "danger-light": "#FEE2E2",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
    },
  },
};
```

### 3.2 Pemetaan Warna Semantik Indikator Bisnis

Agen **wajib** menggunakan pemetaan warna berikut secara konsisten di seluruh _badge_, grafik, dan kartu status:

| Domain Indikator      | Kondisi / Kategori                    | Warna Teks / Ikon | Warna Latar Badge | Warna Stroke Grafik       |
| :-------------------- | :------------------------------------ | :---------------- | :---------------- | :------------------------ |
| **Workload Risk**     | **Rendah** (`< 40`)                   | `#047857`         | `#D1FAE5`         | `#10B981` (Success Green) |
| **Workload Risk**     | **Sedang** (`40 – 69`)                | `#B45309`         | `#FEF3C7`         | `#F59E0B` (Accent Orange) |
| **Workload Risk**     | **Tinggi** (`≥ 70` / _Override_)      | `#B91C1C`         | `#FEE2E2`         | `#EF4444` (Danger Red)    |
| **Decent Work Score** | **Baik** (`≥ 75`)                     | `#047857`         | `#D1FAE5`         | `#10B981` (Success Green) |
| **Decent Work Score** | **Perlu Perhatian** (`50 – 74`)       | `#B45309`         | `#FEF3C7`         | `#F59E0B` (Accent Orange) |
| **Decent Work Score** | **Prioritas Tindakan** (`< 50`)       | `#B91C1C`         | `#FEE2E2`         | `#EF4444` (Danger Red)    |
| **Approval & Status** | `Approved` / `Completed` / `Resolved` | `#047857`         | `#D1FAE5`         | `#10B981`                 |
| **Approval & Status** | `Pending` / `In Progress`             | `#B45309`         | `#FEF3C7`         | `#F59E0B`                 |
| **Approval & Status** | `Open` / `Enrolled` / `Planned`       | `#0369A1`         | `#E0F2FE`         | `#0284C7`                 |
| **Approval & Status** | `Rejected` / `Cancelled` / `Severe`   | `#B91C1C`         | `#FEE2E2`         | `#EF4444`                 |

### 3.3 Skala Tipografi

- **Page Title (`H1`):** `24px` (`1.5rem`), `font-bold`, `leading-tight`, warna `#1E293B`.
- **Section / Card Title (`H2`):** `16px` (`1rem`), `font-semibold`, warna `#1E293B`.
- **KPI Hero Number:** `28px`–`32px` (`1.75rem–2rem`), `font-bold`, `tabular-nums` (wajib _tabular figures_ agar angka sejajar vertikal), warna `#1E293B`.
- **Body & Table Data:** `14px` (`0.875rem`), `font-normal`, warna `#334155`.
- **Table Header & Micro Label:** `12px` (`0.75rem`), `font-semibold`, warna `#64748B`.
- **Status Pill Badge:** `12px` (`0.75rem`), `font-medium`, `px-2.5 py-0.5 rounded-full`.

---

## 4. Kerangka Tata Letak Aplikasi (_App Shell Architecture_)

Mengadaptasi struktur tata letak dasbor HR modern **TeamHub** dengan pembagian ruang kerja yang ergonomis:

```text
+-----------------------------------------------------------------------------+
| [Sidebar 240px] | [Top Header Bar 64px: Title/Breadcrumb | Search | Profile]|
|                 |-----------------------------------------------------------|
| [Logo Hrz]      |                                                           |
|                 |  [Main Content Canvas — bg-[#F8FAFC], padding: 24px]      |
| - Dashboard     |                                                           |
| - Tugas & Log   |  +-------------+ +-------------+ +-------------+ +------+ |
| - Lembur & Cuti |  | KPI Card 1  | | KPI Card 2  | | KPI Card 3  | | KPI 4| |
| - Survei & K3   |  +-------------+ +-------------+ +-------------+ +------+ |
| - Pelatihan     |                                                           |
| - Analitik      |  +-------------------------------+ +--------------------+ |
| - Rekomendasi   |  | Primary Chart (Trends / Bars) | | Donut / Gauge Card | |
| - Laporan       |  +-------------------------------+ +--------------------+ |
|                 |                                                           |
| [Callout Card]  |  +------------------------------------------------------+ |
| PP No. 35/2021  |  | Structured Data Table + Search + Status Filter Pills | |
| 40 Jam / Minggu |  +------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
```

### 4.1 Left Navigation Sidebar (`w-60` / `240px`, Fixed, `bg-white border-r border-slate-200`)

- **Top Brand Area (`h-16`):** Menampilkan `workbalance_horizontal_logo_2.svg` dengan _padding_ kiri `20px`.
- **Menu Navigasi Dinamis Berdasarkan Peran:**
  - **Item Non-Aktif:** Teks `#475569`, ikon `Lucide-react` (`18px`) `#64748B`, _hover_ `bg-slate-100 text-slate-900 rounded-lg`.
  - **Item Aktif:** Latar penuh `#0284C7` (_Primary Blue_) atau `#10B981` (_Success Green_ untuk modul kesejahteraan/decent work), teks `#FFFFFF`, ikon `#FFFFFF`, `rounded-lg font-medium shadow-xs`.
- **Bottom Regulatory Callout Card (Adaptasi Card Bawah Sidebar TeamHub):**
  - Kontainer lembut berlatar `#E0F2FE` (_Blue Light_) atau `#D1FAE5` (_Green Light_) dengan sudut `rounded-xl p-4 mx-3 mb-4`.
  - Menampilkan judul _"Batas Kerja Sehat"_, ringkasan regulasi **PP No. 35/2021** (`40 jam/minggu`, maks lembur `18 jam/minggu`), dan tombol pintas menuju _"Catat Work Log"_ (untuk Pegawai) atau _"Hitung Ulang Indikator"_ (untuk Manajer).

### 4.2 Top Header Bar (`h-16` / `64px`, Sticky, `bg-white/95 backdrop-blur border-b border-slate-200`)

- **Kiri:** Judul halaman aktif (`H1`) dan _breadcrumb_ kecil di bawahnya (contoh: `Analitik / Workload Risk / Detail Pegawai`).
- **Tengah:** _Global Search Input_ (`w-80 bg-slate-100 border-transparent focus:bg-white focus:border-brand-blue rounded-lg text-sm`) untuk mencari pegawai, tugas, atau departemen.
- **Kanan:**
  - Pemilih periode global (`Period Selector`: Minggu berjalan `YYYY-Www` atau Bulan `YYYY-MM`).
  - Tombol notifikasi dengan titik indikator `#F59E0B` (_Accent Orange_) jika ada pengajuan lembur/cuti _pending_ atau rekomendasi baru.
  - Profil pengguna: Avatar inisial/foto bulat (`36px`), nama lengkap, dan _badge_ peran (`Pegawai` / `Manager` / `Admin`).

---

## 5. Katalog Komponen UI & Visualisasi Data (_Recharts_)

### 5.1 Kartu Metrik KPI (_Top Summary Cards_)

- **Struktur:** Grid 4 kolom (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5`).
- **Styling Kartu:** `bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition`.
- **Anatomi Internal:**
  1. Baris atas: Label metrik (`text-xs font-medium text-slate-500`) di kiri + Wadah ikon bulat/memanjang (`w-9 h-9 rounded-lg`) di kanan.
  2. Baris tengah: Angka metrik utama (`text-2xl font-bold text-slate-800 tabular-nums mt-2`).
  3. Baris bawah: _Pill badge_ perbandingan/kategori + keterangan singkat (mis. `+4.2% dari minggu lalu` atau `Ambang aman ≤ 40j`).

### 5.2 Spesifikasi Grafik (_Recharts_)

1. **Decent Work Score Radial Donut Gauge:**
   - Menggunakan `<PieChart>` dengan `innerRadius="72%"`, `outerRadius="92%"`, `startAngle={90}`, `endAngle={-270}`, dan `cornerRadius={8}`.
   - Di bagian tengah lingkaran ditampilkan skor angka besar (`78.5`) dan label status (`Baik` dalam warna hijau).
   - Di bawah grafik ditampilkan _breakdown_ 6 dimensi dalam bentuk _horizontal progress bar_ tipis (`h-2 rounded-full bg-slate-100`).
2. **Hours Logged & Overtime Grouped/Stacked Bar Chart:**
   - Menggunakan `<BarChart>` dengan `radius={[6, 6, 0, 0]}` pada ujung atas batang.
   - Batang jam kerja normal menggunakan `#10B981` (_Success Green_) atau `#0284C7` (_Primary Blue_), dan batang jam lembur menggunakan `#F59E0B` (_Accent Orange_).
   - Dilengkapi garis referensi horizontal putus-putus (`<ReferenceLine y={8} stroke="#EF4444" strokeDasharray="3 3" />`) untuk menandai batas jam kerja normal harian.
3. **Workload Risk & Decent Work Trend Area/Line Chart:**
   - Menggunakan `<AreaChart>` dengan kurva halus (`type="monotone"`), `strokeWidth={2.5}`, gradien isi transparan (`stopOpacity={0.15}` ke `0`), dan `<Tooltip>` kustom berlatar putih dengan bayangan halus.

### 5.3 Tabel Data Operasional & Filter Toolbar

- **Card Wrapper:** `bg-white rounded-xl border border-slate-200/80 overflow-hidden`.
- **Table Toolbar (`p-4 border-b border-slate-100 flex flex-wrap justify-between gap-3`):**
  - Kiri: Judul tabel + _counter badge_ jumlah baris.
  - Kanan: Input pencarian tabel lokal + _Filter Pills_ (mis. `Semua`, `Risiko Tinggi`, `Sedang`, `Rendah`) + tombol aksi utama (`+ Tambah Tugas` / `Ekspor Laporan` dalam warna `#0284C7`).
- **Table Styling:**
  - `thead`: `bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200`.
  - `tbody tr`: `border-b border-slate-100 hover:bg-slate-50/70 transition-colors`.
  - Kolom pegawai selalu menampilkan _avatar_ kecil (`32px`) + Nama lengkap + Sub-teks Jabatan/Departemen.

---

## 6. Blueprint Halaman Utama Berdasarkan Peran

### 6.1 Halaman Autentikasi (`/login` & `/register`)

- **Layout Split-Screen (`50% / 50%` pada desktop):**
  - **Panel Kiri (Visual Brand):** Latar gradasi halus dari `#1E293B` ke `#0369A1`, menampilkan varian logo putih-biru, ilustrasi ringkas 3 pilar keseimbangan kerja, serta kutipan singkat misi SDG 8.
  - **Panel Kanan (Form Card):** Latar putih bersih, logo horizontal di atas, input _Email_ dan _Password_ dengan fokus _ring_ `#0284C7`, dan tombol submit penuh (`w-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold py-2.5 rounded-lg`).

### 6.2 Workspace Pegawai (`/employee/*`)

- **Beranda Pegawai (`/employee/dashboard`):**
  - 4 Kartu KPI Pribadi: _Jam Kerja Minggu Ini_ (vs 40j), _Skor Workload Risk Pribadi_, _Tugas Aktif & Tenggat Dekat_, dan _Sisa Kuota Cuti_.
  - Kolom Kiri (65%): Tabel _Tugas yang Ditugaskan_ dengan tombol aksi cepat _"Catat Work Log"_ langsung pada baris tugas + Grafik batang log jam harian (`Sen–Min`).
  - Kolom Kanan (35%): Kartu _Aksi Cepat_ (Ajukan Lembur, Ajukan Cuti, Isi Survei Periode Ini, Laporkan Masalah/Insiden K3) + Ringkasan Progres Kompetensi.
- **Form Pencatatan & Pengajuan:** Menggunakan _slide-over drawer_ atau _modal_ bersih dengan validasi real-time dan umpan balik _toast notification_ di pojok kanan atas.

### 6.3 Workspace Manajer (`/manager/*`)

- **Executive Dashboard (`/manager/dashboard`):**
  - Baris 1 (KPI): _Rata-rata Workload Risk Tim_, _Pegawai Risiko Tinggi_ (merah), _Decent Work Score Departemen_, dan _Masalah & Pengajuan Menunggu_.
  - Baris 2 (Visualisasi): Grafik Tren Kondisi Kerja & Beban Mingguan (65% lebar) + _Radial Donut Gauge_ Decent Work Score beserta rincian 6 dimensi (35% lebar).
  - Baris 3 (Tindak Lanjut): Tabel _Daftar Pegawai Prioritas Perhatian_ (diurutkan dari skor _Workload Risk_ tertinggi) + Panel _Rekomendasi Tindakan Otomatis_ dengan tombol _"Buat Rencana Tindak Lanjut"_.
- **Halaman Detail Pegawai 360° (`/manager/employees/:id` — Adaptasi Referensi _Employee Details_):**
  - _Kolom Kiri (`w-80`):_ Kartu profil pegawai (Avatar, Nama, Jabatan, Kode Pegawai, _Badge_ Status Aktif, Jenis Kepegawaian, Departemen, Tanggal Bergabung) + Daftar _Kompetensi Pegawai_ (`Current Level` vs `Target Level` dalam bar progres).
  - _Kolom Kanan (`flex-1`):_ 4 Kartu _Radial Mini-Gauge_ untuk 4 sub-indikator _Workload Risk_ (Waktu Kerja, Lembur, Beban Tugas, Tekanan Tenggat), grafik _Workload Risk Trend_, _Bar Chart_ jam kerja mingguan, dan riwayat _Improvement Actions_ terkait pegawai tersebut.
- **Monitoring Tindak Lanjut (`/manager/actions`):**
  - Tampilan tabel/kanban status (`Planned`, `In Progress`, `Completed`) lengkap dengan PIC, tenggat waktu, dan _drawer_ riwayat pembaruan audit (`action_updates`).

### 6.4 Workspace Admin (`/admin/*`)

- **Manajemen Data Master (`/admin/employees`, `/departments`, `/positions`, `/employment-types`):**
  - Tabel CRUD standar dengan indikator relasi aktif (menampilkan _tooltip_ peringatan jika data master tidak dapat dihapus karena masih digunakan oleh pegawai aktif).
- **Konfigurasi Parameter Model (`/admin/model-settings`):**
  - Formulir terstruktur dengan _slider_ / input numerik untuk mengatur ambang batas _Workload Risk_ (jam normal `40`, batas kritis `55`, batas rasio beban) dan distribusi bobot persentase 6 dimensi _Decent Work Score_ (dengan validasi otomatis total bobot = `100%`), disertai log riwayat perubahan konfigurasi.
