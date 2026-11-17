# Product Requirements Document (PRD): WorkBalance

**Versi Dokumen:** 1.0
**Tanggal:** 8 Oktober 2026
**Status:** Disetujui untuk Pengembangan Purwarupa Akademik
**Target Domain:** SDG 8 (_Decent Work and Economic Growth_ — Target 8.5 & 8.8)

---

## 1. Pendahuluan & Latar Belakang Masalah

### 1.1 Ringkasan Eksekutif

**WorkBalance** adalah aplikasi _Decision Support System_ (DSS) berbasis web yang dirancang untuk membantu manajer memantau kondisi pekerjaan pegawai secara terstruktur dan terukur. Sistem ini mengintegrasikan data operasional kerja, kesejahteraan, dan pengembangan kompetensi untuk menghasilkan dua indikator utama: **Workload Risk** (tingkat individu) dan **Decent Work Score** (tingkat departemen), disertai dasbor analitik, rekomendasi tindakan berbasis aturan (_rule-based_), serta pelacakan tindak lanjut perbaikan.

### 1.2 Pernyataan Masalah (_Problem Statement_)

1. **Fragmentasi Data Kondisi Kerja:** Informasi mengenai tugas, jam kerja aktual (_work log_), lembur, cuti, survei kesejahteraan, pelaporan masalah, insiden keselamatan, dan pelatihan tersebar di berbagai media terpisah (_spreadsheet_, formulir, obrolan internal).
2. **Evaluasi Beban Kerja yang Reaktif & Manual:** Manajer harus menggabungkan data secara manual untuk menilai beban kerja, sehingga risiko kelelahan (_burnout_) dan jam kerja berlebih (≥55 jam/minggu menurut standar risiko WHO/ILO atau melewati batas PP No. 35/2021) terlambat terdeteksi.
3. **Tindak Lanjut Tidak Terdokumentasi:** Keputusan dan langkah perbaikan manajerial tidak tercatat dalam sistem pemantauan terpusat sehingga sulit dilacak progres dan akuntabilitasnya.

### 1.3 Tujuan Produk & Metrik Keberhasilan (_Success Metrics_)

| Tujuan Khusus                           | Indikator Keberhasilan (_Acceptance Criteria_)                                                                                                                                            |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Sentralisasi Pencatatan Data**     | Seluruh kelompok data kondisi kerja (organisasi, aktivitas, kesejahteraan, kompetensi, dan tindak lanjut) tersimpan terintegrasi dengan kontrol akses berbasis peran (RBAC).              |
| **2. Akurasi Kalkulasi Indikator**      | Perhitungan _Workload Risk_ (per pegawai/minggu) dan _Decent Work Score_ (per departemen/bulan) menghasilkan output yang 100% konsisten dengan perhitungan manual pada seluruh kasus uji. |
| **3. Penyajian Keputusan & Monitoring** | Manajer dapat memantau tren melalui dasbor, menerima rekomendasi tindakan otomatis, mencatat rencana perbaikan beserta tenggat/PIC, serta mengunduh laporan periodik.                     |

---

## 2. Batasan & Ruang Lingkup Produk (_Scope & Guardrails_)

> **PENTING (Untuk Eksekusi Agen):** Aturan berikut adalah batasan mutlak ruang lingkup produk yang tidak boleh dilanggar selama pengembangan:

- **Purwarupa Akademik (Non-Produksi):** Dikembangkan untuk lingkungan pengembangan lokal menggunakan data sintetis/_dummy_.
- **Tanpa Integrasi Eksternal:** Tidak ada integrasi dengan sistem _payroll_, mesin absensi biometrik, BPJS, atau API pihak ketiga.
- **Fungsi DSS (Bukan HRIS Utama atau Alat Penilaian Kinerja):**
  - Sistem **bukan** pengganti HRIS menyeluruh.
  - Indikator _Workload Risk_ dan _Decent Work Score_ adalah model konseptual tim (mengacu pada ILO 2012 & PP No. 35/2021), **bukan** standar resmi pemerintah/ILO, dan **dilarang** digunakan sebagai instrumen penilaian KPI/kinerja individu, diagnosis medis, atau pemutusan hubungan kerja otomatis.
- **Privasi Survei:** Respons survei kondisi kerja pegawai bersifat rahasia dan **hanya** boleh ditampilkan kepada Manajer dalam bentuk **agregat departemen** (tidak boleh mengekspos jawaban individu ke Manajer).

---

## 3. Karakteristik Pengguna & Hak Akses (RBAC)

Sistem menerapkan pemisahan hak akses ketat untuk menjaga objektivitas dan privasi data:

1. **Pegawai (_Employee_)**
   - **Peran:** Pelaksana tugas dan pelapor kondisi kerja aktual.
   - **Hak Akses:** Melihat data pribadi & skor _Workload Risk_ milik sendiri; mencatat dan memperbarui _Work Log_; mengajukan lembur dan cuti; mengisi survei kondisi kerja; melaporkan permasalahan kerja & insiden keselamatan serta memantau status penanganannya; mencatat keterampilan/kompetensi pribadi.
2. **Manajer (_Manager_)**
   - **Peran:** Pemantau kondisi tim dan pengambil keputusan perbaikan.
   - **Hak Akses:** Mengelola tugas & penugasan tim; meninjau serta menyetujui/menolak pengajuan lembur dan cuti; mengelola pelatihan & kompetensi tim; melihat _Workload Risk_ anggota tim; melihat _Decent Work Score_ & hasil survei dalam bentuk **agregat**; melihat dasbor, rekomendasi tindakan, mengelola monitoring tindak lanjut, dan mengunduh laporan.
3. **Admin (_Administrator_)**
   - **Peran:** Pengelola konfigurasi sistem dan data master.
   - **Hak Akses:** Akses penuh (_full access_) terhadap manajemen akun pengguna, peran (RBAC), data master organisasi (departemen, posisi, jenis kepegawaian), program pelatihan, kompensasi, serta konfigurasi bobot/ambang batas model indikator.

---

## 4. Logika Bisnis Inti (_Core Business Logic_)

### 4.1 Perhitungan _Workload Risk_ (Level Individu — Mingguan & Ringkasan Bulanan)

Dihitung dari 4 indikator berskala `0–100` menggunakan **interpolasi linear** di antara batas bawah (`Skor 0`) dan batas atas (`Skor 100`), dengan bobot awal rata-rata sama (25% per indikator):

| No  | Indikator                | Formula / Sumber Data                                                                                                                                                                                    | Skor 0 (Aman)     | Skor 100 (Maksimal)                                                                   |
| :-- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- | :------------------------------------------------------------------------------------ |
| 1   | **Waktu Kerja Mingguan** | Total jam tercatat pada _Work Log_ dalam 1 minggu.                                                                                                                                                       | $\le 40$ jam      | $\ge 55$ jam                                                                          |
| 2   | **Lembur**               | Proporsi hari kerja lembur (jam aktual > 8 jam untuk 5 hari kerja, atau > 7 jam untuk 6 hari kerja). _Menggunakan data lembur disetujui jika modul lembur aktif, atau kalkulasi otomatis dari Work Log._ | $0\%$ hari lembur | $100\%$ hari kerja lembur, **atau** lembur $> 4$ jam/hari, **atau** $> 18$ jam/minggu |
| 3   | **Beban Tugas**          | $\frac{\text{Total estimasi jam tugas aktif}}{\text{Kapasitas jam tersedia (40 jam - jam cuti)}}$                                                                                                        | Rasio $\le 1,0$   | Rasio $\ge 1,5$                                                                       |
| 4   | **Tekanan Tenggat**      | Proporsi tugas aktif yang jatuh tempo dalam $\le 7$ hari atau sudah melewati tenggat (_overdue_).                                                                                                        | $0\%$             | $100\%$                                                                               |

- **Kategorisasi Skor Akhir:**
  - **Rendah:** $< 40$
  - **Sedang:** $40 - 69$
  - **Tinggi:** $\ge 70$
  - **Aturan Override Wajib:** Jika waktu kerja mingguan pegawai $\ge 55$ jam **atau** lembur melampaui batas PP No. 35/2021 ($> 4$ jam/hari atau $> 18$ jam/minggu), kategori otomatis ditetapkan menjadi **Tinggi** meskipun skor rata-rata akhirnya $< 70$.

### 4.2 Perhitungan _Decent Work Score_ (Level Departemen — Bulanan)

Dihitung per departemen setiap bulan dari rata-rata 6 dimensi berskala `0–100` (bobot awal sama, dapat dikonfigurasi Admin):

| Dimensi                               | Rumus Perhitungan                                                                                                                                                   | Sumber Data                 |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------- |
| **1. Waktu Kerja & Beban**            | $100 - \text{Rata-rata skor Workload Risk pegawai dalam departemen}$                                                                                                | Hasil _Workload Risk_       |
| **2. Keseimbangan Kehidupan & Kerja** | $\frac{\text{Rata-rata skor butir survei (skala 1–5)} - 1}{4} \times 100$                                                                                           | Respons Survei (Agregat)    |
| **3. Kelengkapan Kompensasi**         | Persentase pegawai departemen yang memiliki catatan data kompensasi pada periode berjalan _(hanya mengukur kelengkapan data, bukan kelayakan nominal upah)_.        | Data Kompensasi             |
| **4. Keselamatan Kerja**              | Rata-rata dari: (a) $\max(0, 100 - (50 \times \text{jumlah insiden berat}))$, dan (b) Persentase insiden yang berstatus selesai ditangani ($100\%$ jika 0 insiden). | Insiden Keselamatan         |
| **5. Suara Pekerja**                  | Rata-rata dari: (a) Persentase laporan permasalahan kerja yang sudah ditangani, dan (b) Persentase partisipasi pegawai mengisi survei.                              | Permasalahan Kerja & Survei |
| **6. Pengembangan Kompetensi**        | Rata-rata dari: (a) Persentase pegawai mengikuti minimal 1 pelatihan, dan (b) Persentase kompetensi pegawai yang mencapai target.                                   | Pelatihan & Kompetensi      |

- **Kategorisasi Skor Akhir:**
  - **Baik:** $\ge 75$
  - **Perlu Perhatian:** $50 - 74$
  - **Prioritas Tindakan:** $< 50$

### 4.3 Mesin Rekomendasi Berbasis Ambang Batas (_Rule-Based_)

Sistem menghasilkan rekomendasi tindakan secara deterministik (tanpa _machine learning_):

- Pegawai dengan kategori _Workload Risk_ **Tinggi** $\rightarrow$ Memicu rekomendasi evaluasi dan redistribusi tugas.
- Dimensi _Decent Work Score_ dengan nilai terendah pada suatu departemen $\rightarrow$ Memicu rekomendasi perbaikan spesifik pada dimensi terkait.
- Kompetensi pegawai di bawah level target $\rightarrow$ Memicu rekomendasi pendaftaran program pelatihan relevan.

---

## 5. Kebutuhan Fungsional (_Functional Requirements_)

### Modul 1: Autentikasi & Manajemen Data Master

- **FR-01 (Autentikasi & RBAC):** Sistem menyediakan registrasi, login, logout, pengelolaan profil sesi, dan pembatasan akses rute/fitur berdasarkan peran (`Pegawai`, `Manager`, `Admin`).
- **FR-02 (Manajemen Pegawai):** Admin dapat melakukan operasi CRUD pada data master pegawai beserta status keaktifan akun.
- **FR-03 (Manajemen Departemen):** Admin dapat mengelola data departemen sebagai unit pengelompokan analisis.
- **FR-04 (Manajemen Posisi/Jabatan):** Admin dapat mengelola daftar jabatan pegawai (penghapusan ditolak jika masih berelasi dengan pegawai aktif).
- **FR-05 (Manajemen Jenis Kepegawaian):** Admin dapat mengelola kategori hubungan kerja (tetap, kontrak, magang, dll.).

### Modul 2: Operasional Tugas & Aktivitas Kerja

- **FR-06 (Manajemen Tugas):** Manajer dapat membuat, melihat, mengubah, dan menghapus tugas lengkap dengan estimasi jam, tingkat prioritas, dan tenggat waktu (_deadline_).
- **FR-07 (Penugasan Pekerjaan):** Manajer dapat menetapkan dan memperbarui distribusi tugas kepada pegawai.
- **FR-08 (Pencatatan _Work Log_):** Pegawai dapat mencatat log aktivitas harian beserta durasi jam kerja aktual; sistem menampilkan daftar tugas yang ditugaskan kepada pegawai tersebut.
- **FR-09 (Pengelolaan Lembur):** Pegawai dapat mengajukan lembur (tanggal, durasi, alasan); Manajer dapat meninjau dan mengubah status menjadi _Disetujui_ atau _Ditolak_.
- **FR-10 (Pengelolaan Cuti):** Pegawai dapat mengajukan permohonan cuti; Manajer dapat menyetujui atau menolak pengajuan tersebut (jam cuti yang disetujui otomatis mengurangi kapasitas jam kerja pada kalkulasi Beban Tugas).
- **FR-11 (Pengelolaan Kompensasi):** Admin/Manajer dapat mencatat dan memperbarui data komponen kompensasi pegawai.

### Modul 3: Kesejahteraan, Keselamatan & Pengembangan Kompetensi

- **FR-12 (Survei Kondisi Kerja):** Sistem menyediakan instrumen survei berkala (skala Likert 1–5) terkait keseimbangan kerja-hidup dan kondisi kerja yang dapat diisi oleh pegawai.
- **FR-13 (Pengelolaan Permasalahan Kerja):** Pegawai dapat mengirimkan laporan permasalahan/konflik kerja dan memantau status penanganannya; Manajer dapat menindaklanjuti dan memperbarui status laporan.
- **FR-14 (Pengelolaan Insiden Keselamatan):** Pegawai/Pengelola dapat mencatat insiden K3 (waktu, lokasi, deskripsi, tingkat keparahan: ringan/sedang/berat) serta memantau status penanganannya.
- **FR-15 (Pengelolaan Pelatihan):** Admin/Manajer dapat mengelola katalog program pelatihan serta mendaftarkan dan memantau status kelulusan keikutsertaan pegawai.
- **FR-16 (Pengelolaan Kompetensi):** Sistem mencatat daftar keterampilan/kompetensi pegawai, level saat ini, dan level target pengembangan.

### Modul 4: Analitik, Dasbor, Rekomendasi & Pelaporan

- **FR-17 (Analisis _Workload Risk_):** Sistem menghitung dan memperbarui skor serta kategori risiko beban kerja setiap pegawai berdasarkan parameter pada Sub-Bab 4.1.
- **FR-18 (Analisis _Decent Work Score_):** Sistem menghitung dan menampilkan skor komposit 6 dimensi per departemen berdasarkan parameter pada Sub-Bab 4.2.
- **FR-19 (_Dashboard_ & Monitoring Tren):**
  - **Tampilan Pegawai:** Ringkasan tugas aktif, rekap jam kerja pribadi, dan skor _Workload Risk_ pribadi.
  - **Tampilan Manajer:** Ringkasan indikator tim, distribusi kategori _Workload Risk_ pegawai, skor _Decent Work Score_, serta grafik tren dengan filter **periode** dan **departemen**.
- **FR-20 (Rekomendasi Tindakan):** Sistem menampilkan daftar rekomendasi tindakan otomatis berdasarkan pemicu risiko dan dimensi terendah.
- **FR-21 (Monitoring Tindak Lanjut):** Manajer dapat membuat rencana tindakan perbaikan (baik dari rekomendasi sistem maupun manual), menetapkan penanggung jawab (PIC), tenggat waktu, dan memperbarui progres status penyelesaiannya.
- **FR-22 (Pelaporan Periodik):** Manajer dapat menyusun, melihat, dan mengunduh laporan evaluasi kondisi kerja berdasarkan filter periode dan departemen.

---

## 6. Kebutuhan Non-Fungsional (_Non-Functional Requirements_)

- **NFR-01 (Keamanan):** Menerapkan autentikasi berbasis token sesi, otorisasi ketat berbasis peran (RBAC) di sisi server, validasi seluruh input formulir, dan pencegahan akses lintas peran yang tidak sah.
- **NFR-02 (Privasi Data):** Data sensitif (kompensasi, kesehatan/insiden, dan jawaban survei) dilindungi; respons survei individu tidak boleh terekspos ke antarmuka Manajer kecuali dalam bentuk skor agregat departemen.
- **NFR-03 (Kinerja):** Waktu respons operasi CRUD standar dan pemuatan visualisasi dasbor berjalan lancar dan responsif pada skenario data uji lokal.
- **NFR-04 (Keandalan & Integritas Data):** Menjaga integritas referensial antar-entitas (mencegah penghapusan data master yang masih direferensikan) serta penanganan galat (_error handling_) yang informatif tanpa merusak _state_ data tersimpan.
- **NFR-05 (_Usability_):** Antarmuka konsisten, responsif di berbagai ukuran layar desktop, dan memiliki alur navigasi yang jelas sesuai masing-masing peran pengguna.
- **NFR-06 (_Maintainability_):** Kode disusun secara modular dengan pemisahan yang jelas antara logika bisnis kalkulasi indikator, layanan API, dan komponen antarmuka.
- **NFR-07 (_Scalability_ Model):** Ambang batas (_threshold_) dan bobot indikator pada _Workload Risk_ maupun _Decent Work Score_ tidak boleh di-_hardcode_ secara kaku, melainkan dapat dikonfigurasi melalui pengaturan sistem.
- **NFR-08 (_Auditability_):** Setiap perubahan pada status tindak lanjut perbaikan, persetujuan lembur/cuti, penanganan masalah/insiden, serta perubahan bobot konfigurasi model tercatat riwayat pembaruannya.

---

## 7. Prioritas Pengerjaan (_Product Backlog & Roadmap_)

Pengembangan dibagi ke dalam tiga tahapan rilis iteratif:

1. **Fase 0 — Inisiasi & Fondasi Teknis:**
   - Inisialisasi repositori, skema basis data terintegrasi, mekanisme autentikasi, serta _middleware_ otorisasi RBAC (`Pegawai`, `Manager`, `Admin`).
2. **Fase 1 — Fondasi Data Master & Operasional Inti:**
   - Manajemen data pegawai, jenis kepegawaian, departemen, jabatan (`PBI-01`, `PBI-02`, `PBI-12`).
   - Manajemen tugas, penugasan kerja, pencatatan _Work Log_, pengajuan lembur & cuti (`PBI-03`, `PBI-04`, `PBI-09`).
   - Katalog & keikutsertaan pelatihan, survei kondisi kerja, pelaporan permasalahan kerja (`PBI-05`, `PBI-06`, `PBI-07`, `PBI-08`).
   - Kalkulasi awal _Workload Risk_ & ringkasan indikator dasbor Manajer (`PBI-10`, `PBI-11`).
3. **Fase 2 — Analitik Lanjutan, Rekomendasi & Pelaporan:**
   - Manajemen kompetensi pegawai dan pelaporan insiden keselamatan K3 (`PBI-13`, `PBI-14`).
   - Kalkulasi komposit _Decent Work Score_ per departemen (`PBI-17`).
   - Filter perbandingan tren antar-periode/departemen, mesin rekomendasi tindakan otomatis, monitoring tindak lanjut perbaikan, dan ekspor laporan periodik (`PBI-15`, `PBI-16`, `PBI-18`).
