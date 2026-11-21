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
      label: 'Analitik',
      items: [
        { label: 'Kondisi Kerja Tim', to: '/admin/dashboard', icon: LayoutDashboard, keywords: 'dashboard ringkasan kpi decent work' },
        { label: 'Risiko Beban Kerja', to: '/admin/workload-risk', icon: Activity, keywords: 'workload risk lembur pp 35' },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { label: 'Tugas', to: '/admin/tasks', icon: ClipboardList, keywords: 'task manajemen tugas estimasi prioritas' },
        { label: 'Penugasan', to: '/admin/task-assignments', icon: ClipboardCheck, keywords: 'assignment distribusi tenggat' },
        { label: 'Log Kerja', to: '/admin/work-logs', icon: Clock, keywords: 'work log catatan waktu jam harian' },
      ],
    },
    {
      label: 'Kesejahteraan',
      items: [
        { label: 'Survei', to: '/admin/surveys', icon: HeartHandshake, keywords: 'survey wellbeing agregasi kondisi kerja' },
        { label: 'Masalah & K3', to: '/admin/workplace-issues', icon: MessageSquareWarning, keywords: 'k3 insiden permasalahan kerja laporan' },
        { label: 'Pelatihan', to: '/admin/trainings', icon: GraduationCap, keywords: 'training katalog kursus kompetensi' },
        { label: 'Partisipasi', to: '/admin/training-participations', icon: Award, keywords: 'keikutsertaan sertifikasi pelatihan' },
      ],
    },
    {
      label: 'Organisasi',
      items: [
        { label: 'Pegawai', to: '/admin/employees', icon: Users, keywords: 'employee karyawan kepegawaian master' },
        { label: 'Departemen', to: '/admin/departments', icon: Building2, keywords: 'department divisi struktur' },
      ],
    },
  ],
  manager: [
    {
      label: 'Analitik',
      items: [
        { label: 'Kondisi Kerja Tim', to: '/manager/dashboard', icon: LayoutDashboard, keywords: 'dashboard tim kpi decent work' },
        { label: 'Risiko Beban Kerja', to: '/manager/workload-risk', icon: Activity, keywords: 'workload risk lembur pp 35' },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { label: 'Tugas', to: '/manager/tasks', icon: ClipboardList, keywords: 'task manajemen tugas estimasi prioritas' },
        { label: 'Penugasan', to: '/manager/task-assignments', icon: ClipboardCheck, keywords: 'assignment distribusi tenggat' },
        { label: 'Log Kerja', to: '/manager/work-logs', icon: Clock, keywords: 'work log catatan waktu jam harian' },
      ],
    },
    {
      label: 'Kesejahteraan',
      items: [
        { label: 'Survei', to: '/manager/surveys', icon: HeartHandshake, keywords: 'survey wellbeing agregasi departemen' },
        { label: 'Masalah & K3', to: '/manager/workplace-issues', icon: MessageSquareWarning, keywords: 'k3 insiden permasalahan kerja' },
        { label: 'Pelatihan', to: '/manager/trainings', icon: GraduationCap, keywords: 'training katalog kursus' },
        { label: 'Partisipasi', to: '/manager/training-participations', icon: Award, keywords: 'keikutsertaan pelatihan tim' },
      ],
    },
    {
      label: 'Tim',
      items: [
        { label: 'Direktori Tim', to: '/manager/employees', icon: Users, keywords: 'employee anggota pegawai tim' },
        { label: 'Departemen', to: '/manager/departments', icon: Building2, keywords: 'department divisi struktur' },
      ],
    },
  ],
  employee: [
    {
      label: 'Ruang Kerja',
      items: [
        { label: 'Beranda', to: '/employee/dashboard', icon: LayoutDashboard, keywords: 'beranda profil ringkasan pegawai' },
        { label: 'Risiko Saya', to: '/employee/workload-risk', icon: Activity, keywords: 'workload risk beban kerja pribadi' },
      ],
    },
    {
      label: 'Aktivitas',
      items: [
        { label: 'Tugas', to: '/employee/tasks', icon: ClipboardList, keywords: 'task daftar tugas' },
        { label: 'Penugasan', to: '/employee/task-assignments', icon: ClipboardCheck, keywords: 'assignment tenggat penugasan saya' },
        { label: 'Log Kerja', to: '/employee/work-logs', icon: Clock, keywords: 'work log catat jam waktu kerja' },
      ],
    },
    {
      label: 'Kesejahteraan',
      items: [
        { label: 'Pelatihan', to: '/employee/training-participations', icon: Award, keywords: 'training pelatihan saya' },
        { label: 'Survei', to: '/employee/surveys', icon: HeartHandshake, keywords: 'survey kondisi kerja kesejahteraan' },
        { label: 'Masalah & K3', to: '/employee/workplace-issues', icon: MessageSquareWarning, keywords: 'lapor k3 permasalahan kerja' },
      ],
    },
  ],
};

export function getNavGroupsForRole(role) {
  return NAV_GROUPS_BY_ROLE[role] || [];
}
