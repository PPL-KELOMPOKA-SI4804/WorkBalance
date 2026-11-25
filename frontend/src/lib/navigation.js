import {
  Activity,
  Award,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  GraduationCap,
  HeartHandshake,
  LayoutGrid,
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

export const DASHBOARD_ITEM_BY_ROLE = {
  admin: {
    label: 'Dashboard',
    commandLabel: 'Kondisi Kerja Tim',
    to: '/admin/dashboard',
    icon: LayoutGrid,
    keywords: 'dashboard beranda ringkasan kpi decent work kondisi kerja tim',
  },
  manager: {
    label: 'Dashboard',
    commandLabel: 'Kondisi Kerja Tim',
    to: '/manager/dashboard',
    icon: LayoutGrid,
    keywords: 'dashboard beranda tim kpi decent work kondisi kerja',
  },
  employee: {
    label: 'Beranda',
    commandLabel: 'Beranda Pegawai',
    to: '/employee/dashboard',
    icon: LayoutGrid,
    keywords: 'beranda dashboard profil ringkasan pegawai',
  },
};

export const NAV_GROUPS_BY_ROLE = {
  admin: [
    {
      id: 'analytics',
      label: 'Analitik',
      icon: Activity,
      items: [
        {
          label: 'Risiko Beban Kerja',
          to: '/admin/workload-risk',
          icon: Activity,
          keywords: 'workload risk lembur pp 35',
        },
      ],
    },
    {
      id: 'operations',
      label: 'Operasional',
      icon: Briefcase,
      items: [
        {
          label: 'Tugas',
          to: '/admin/tasks',
          icon: ClipboardList,
          keywords: 'task manajemen tugas estimasi prioritas',
        },
        {
          label: 'Penugasan',
          to: '/admin/task-assignments',
          icon: ClipboardCheck,
          keywords: 'assignment distribusi tenggat',
        },
        {
          label: 'Log Kerja',
          to: '/admin/work-logs',
          icon: Clock,
          keywords: 'work log catatan waktu jam harian',
        },
      ],
    },
    {
      id: 'wellbeing',
      label: 'Kesejahteraan',
      icon: HeartHandshake,
      items: [
        {
          label: 'Survei',
          to: '/admin/surveys',
          icon: HeartHandshake,
          keywords: 'survey wellbeing agregasi kondisi kerja',
        },
        {
          label: 'Masalah & K3',
          to: '/admin/workplace-issues',
          icon: MessageSquareWarning,
          keywords: 'k3 insiden permasalahan kerja laporan',
        },
        {
          label: 'Pelatihan',
          to: '/admin/trainings',
          icon: GraduationCap,
          keywords: 'training katalog kursus kompetensi',
        },
        {
          label: 'Partisipasi',
          to: '/admin/training-participations',
          icon: Award,
          keywords: 'keikutsertaan sertifikasi pelatihan',
        },
      ],
    },
    {
      id: 'organization',
      label: 'Organisasi',
      icon: Users,
      items: [
        {
          label: 'Pegawai',
          to: '/admin/employees',
          icon: Users,
          keywords: 'employee karyawan kepegawaian master',
        },
        {
          label: 'Departemen',
          to: '/admin/departments',
          icon: Building2,
          keywords: 'department divisi struktur',
        },
      ],
    },
  ],
  manager: [
    {
      id: 'analytics',
      label: 'Analitik',
      icon: Activity,
      items: [
        {
          label: 'Risiko Beban Kerja',
          to: '/manager/workload-risk',
          icon: Activity,
          keywords: 'workload risk lembur pp 35',
        },
      ],
    },
    {
      id: 'operations',
      label: 'Operasional',
      icon: Briefcase,
      items: [
        {
          label: 'Tugas',
          to: '/manager/tasks',
          icon: ClipboardList,
          keywords: 'task manajemen tugas estimasi prioritas',
        },
        {
          label: 'Penugasan',
          to: '/manager/task-assignments',
          icon: ClipboardCheck,
          keywords: 'assignment distribusi tenggat',
        },
        {
          label: 'Log Kerja',
          to: '/manager/work-logs',
          icon: Clock,
          keywords: 'work log catatan waktu jam harian',
        },
      ],
    },
    {
      id: 'wellbeing',
      label: 'Kesejahteraan',
      icon: HeartHandshake,
      items: [
        {
          label: 'Survei',
          to: '/manager/surveys',
          icon: HeartHandshake,
          keywords: 'survey wellbeing agregasi departemen',
        },
        {
          label: 'Masalah & K3',
          to: '/manager/workplace-issues',
          icon: MessageSquareWarning,
          keywords: 'k3 insiden permasalahan kerja',
        },
        {
          label: 'Pelatihan',
          to: '/manager/trainings',
          icon: GraduationCap,
          keywords: 'training katalog kursus',
        },
        {
          label: 'Partisipasi',
          to: '/manager/training-participations',
          icon: Award,
          keywords: 'keikutsertaan pelatihan tim',
        },
      ],
    },
    {
      id: 'team',
      label: 'Tim',
      icon: Users,
      items: [
        {
          label: 'Direktori Tim',
          to: '/manager/employees',
          icon: Users,
          keywords: 'employee anggota pegawai tim',
        },
        {
          label: 'Departemen',
          to: '/manager/departments',
          icon: Building2,
          keywords: 'department divisi struktur',
        },
      ],
    },
  ],
  employee: [
    {
      id: 'activity',
      label: 'Aktivitas',
      icon: Briefcase,
      items: [
        {
          label: 'Risiko Saya',
          to: '/employee/workload-risk',
          icon: Activity,
          keywords: 'workload risk beban kerja pribadi',
        },
        {
          label: 'Tugas',
          to: '/employee/tasks',
          icon: ClipboardList,
          keywords: 'task daftar tugas',
        },
        {
          label: 'Penugasan',
          to: '/employee/task-assignments',
          icon: ClipboardCheck,
          keywords: 'assignment tenggat penugasan saya',
        },
        {
          label: 'Log Kerja',
          to: '/employee/work-logs',
          icon: Clock,
          keywords: 'work log catat jam waktu kerja',
        },
      ],
    },
    {
      id: 'wellbeing',
      label: 'Kesejahteraan',
      icon: HeartHandshake,
      items: [
        {
          label: 'Pelatihan',
          to: '/employee/training-participations',
          icon: Award,
          keywords: 'training pelatihan saya',
        },
        {
          label: 'Survei',
          to: '/employee/surveys',
          icon: HeartHandshake,
          keywords: 'survey kondisi kerja kesejahteraan',
        },
        {
          label: 'Masalah & K3',
          to: '/employee/workplace-issues',
          icon: MessageSquareWarning,
          keywords: 'lapor k3 permasalahan kerja',
        },
      ],
    },
  ],
};

export function getDashboardItemForRole(role) {
  return DASHBOARD_ITEM_BY_ROLE[role] || null;
}

export function getNavGroupsForRole(role) {
  return NAV_GROUPS_BY_ROLE[role] || [];
}
