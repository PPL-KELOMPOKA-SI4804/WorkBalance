import {
  Activity,
  Award,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareWarning,
  Users,
} from 'lucide-react';

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manajer',
  employee: 'Pegawai',
};

export const ROLE_TONES = {
  admin: 'info',
  manager: 'success',
  employee: 'warning',
};

export function getInitials(name, email) {
  const source = name || email || 'WB';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export const NAV_GROUPS_BY_ROLE = {
  admin: [
    {
      label: 'Ikhtisar & Analitik',
      items: [
        { label: 'Dasbor Kondisi Kerja', to: '/admin/dashboard', icon: LayoutDashboard, keywords: 'dashboard ringkasan kpi decent work' },
        { label: 'Analisis Workload Risk', to: '/admin/workload-risk', icon: Activity, keywords: 'risiko beban kerja lembur pp 35' },
      ],
    },
    {
      label: 'Operasional Kerja',
      items: [
        { label: 'Manajemen Tugas', to: '/admin/tasks', icon: ClipboardList, keywords: 'task tugas estimasi prioritas' },
        { label: 'Penugasan Kerja', to: '/admin/task-assignments', icon: ClipboardCheck, keywords: 'assignment distribusi tenggat' },
        { label: 'Catatan Waktu Kerja', to: '/admin/work-logs', icon: Clock, keywords: 'work log jam kerja harian' },
      ],
    },
    {
      label: 'Kesejahteraan & Kompetensi',
      items: [
        { label: 'Survei Kondisi Kerja', to: '/admin/surveys', icon: HeartHandshake, keywords: 'survey wellbeing agregasi' },
        { label: 'Permasalahan Kerja', to: '/admin/workplace-issues', icon: MessageSquareWarning, keywords: 'k3 insiden masalah laporan' },
        { label: 'Katalog Pelatihan', to: '/admin/trainings', icon: GraduationCap, keywords: 'training kursus kompetensi' },
        { label: 'Keikutsertaan Pelatihan', to: '/admin/training-participations', icon: Award, keywords: 'partisipasi sertifikasi pelatihan' },
      ],
    },
    {
      label: 'Master Organisasi',
      items: [
        { label: 'Pegawai & Kepegawaian', to: '/admin/employees', icon: Users, keywords: 'employee karyawan master' },
        { label: 'Data Departemen', to: '/admin/departments', icon: Building2, keywords: 'department divisi struktur' },
      ],
    },
  ],
  manager: [
    {
      label: 'Ikhtisar & Analitik',
      items: [
        { label: 'Dasbor Kondisi Kerja', to: '/manager/dashboard', icon: LayoutDashboard, keywords: 'dashboard tim kpi decent work' },
        { label: 'Analisis Workload Risk', to: '/manager/workload-risk', icon: Activity, keywords: 'risiko beban kerja lembur pp 35' },
      ],
    },
    {
      label: 'Operasional Kerja',
      items: [
        { label: 'Manajemen Tugas', to: '/manager/tasks', icon: ClipboardList, keywords: 'task tugas estimasi prioritas' },
        { label: 'Penugasan Kerja', to: '/manager/task-assignments', icon: ClipboardCheck, keywords: 'assignment distribusi tenggat' },
        { label: 'Catatan Waktu Kerja', to: '/manager/work-logs', icon: Clock, keywords: 'work log jam kerja harian' },
      ],
    },
    {
      label: 'Kesejahteraan & Kompetensi',
      items: [
        { label: 'Survei Kondisi Kerja', to: '/manager/surveys', icon: HeartHandshake, keywords: 'survey wellbeing agregasi departemen' },
        { label: 'Permasalahan Kerja', to: '/manager/workplace-issues', icon: MessageSquareWarning, keywords: 'k3 insiden masalah laporan' },
        { label: 'Katalog Pelatihan', to: '/manager/trainings', icon: GraduationCap, keywords: 'training kursus kompetensi' },
        { label: 'Keikutsertaan Pelatihan', to: '/manager/training-participations', icon: Award, keywords: 'partisipasi pelatihan tim' },
      ],
    },
    {
      label: 'Organisasi & Tim',
      items: [
        { label: 'Direktori Tim', to: '/manager/employees', icon: Users, keywords: 'employee anggota tim' },
        { label: 'Struktur Departemen', to: '/manager/departments', icon: Building2, keywords: 'department divisi' },
      ],
    },
  ],
  employee: [
    {
      label: 'Ruang Kerja Saya',
      items: [
        { label: 'Beranda Pegawai', to: '/employee/dashboard', icon: LayoutDashboard, keywords: 'beranda profil ringkasan' },
        { label: 'Workload Risk Saya', to: '/employee/workload-risk', icon: Activity, keywords: 'risiko beban kerja pribadi' },
      ],
    },
    {
      label: 'Aktivitas & Tugas',
      items: [
        { label: 'Daftar Tugas', to: '/employee/tasks', icon: ClipboardList, keywords: 'task tugas' },
        { label: 'Penugasan Saya', to: '/employee/task-assignments', icon: ClipboardCheck, keywords: 'assignment tenggat' },
        { label: 'Catatan Waktu Kerja', to: '/employee/work-logs', icon: Clock, keywords: 'work log catat jam' },
      ],
    },
    {
      label: 'Kesejahteraan & Pelatihan',
      items: [
        { label: 'Pelatihan Saya', to: '/employee/training-participations', icon: Award, keywords: 'training pelatihan' },
        { label: 'Survei Kondisi Kerja', to: '/employee/surveys', icon: HeartHandshake, keywords: 'survey kesejahteraan' },
        { label: 'Permasalahan Kerja', to: '/employee/workplace-issues', icon: MessageSquareWarning, keywords: 'lapor k3 masalah' },
      ],
    },
  ],
};

export function getNavGroupsForRole(role) {
  return NAV_GROUPS_BY_ROLE[role] || [];
}
