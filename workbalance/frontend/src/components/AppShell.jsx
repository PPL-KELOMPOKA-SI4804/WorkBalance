import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manajer',
  employee: 'Pegawai',
};

const ROLE_BADGE_CLASSES = {
  admin: 'bg-[#E0F2FE] text-[#0369A1]',
  manager: 'bg-[#D1FAE5] text-[#047857]',
  employee: 'bg-[#FEF3C7] text-[#B45309]',
};

function getInitials(name, email) {
  const source = name || email || 'WB';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function AppShell({
  title,
  breadcrumb,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Cari pegawai atau kode...',
  children,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItemsByRole = {
    admin: [
      { label: 'Pegawai & Kepegawaian', to: '/admin/employees', icon: Users },
      { label: 'Data Departemen', to: '/admin/departments', icon: Building2 },
      { label: 'Manajemen Tugas', to: '/admin/tasks', icon: ClipboardList },
      { label: 'Penugasan Kerja', to: '/admin/task-assignments', icon: ClipboardCheck },
      { label: 'Katalog Pelatihan', to: '/admin/trainings', icon: GraduationCap },
      { label: 'Keikutsertaan Pelatihan', to: '/admin/training-participations', icon: Award },
    ],
    manager: [
      { label: 'Direktori Tim', to: '/manager/employees', icon: Users },
      { label: 'Struktur Departemen', to: '/manager/departments', icon: Building2 },
      { label: 'Manajemen Tugas', to: '/manager/tasks', icon: ClipboardList },
      { label: 'Penugasan Kerja', to: '/manager/task-assignments', icon: ClipboardCheck },
      { label: 'Katalog Pelatihan', to: '/manager/trainings', icon: GraduationCap },
      { label: 'Keikutsertaan Pelatihan', to: '/manager/training-participations', icon: Award },
    ],
    employee: [
      { label: 'Beranda Pegawai', to: '/employee/dashboard', icon: LayoutDashboard },
      { label: 'Daftar Tugas', to: '/employee/tasks', icon: ClipboardList },
      { label: 'Penugasan Saya', to: '/employee/task-assignments', icon: ClipboardCheck },
      { label: 'Pelatihan Saya', to: '/employee/training-participations', icon: Award },
    ],
  };

  const navItems = navItemsByRole[user?.role] || [];
  const fullName = user?.employee?.full_name || user?.email || 'Pengguna WorkBalance';
  const initials = getInitials(user?.employee?.full_name, user?.email);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
        <img
          src="/assets/workbalance_horizontal_logo_2.svg"
          alt="WorkBalance"
          className="h-9 w-auto"
        />
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Tutup navigasi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigasi Utama
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#0284C7] text-white font-medium shadow-xs'
                  : 'text-[#475569] hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-[#64748B]'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-100">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Status Modul
          </p>
          <div className="px-3 py-2 flex items-center gap-2.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>Sprint 0, PBI-01 s.d. PBI-06 Aktif</span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2.5 text-xs text-slate-400">
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Modul Lanjutan (Sprint 1–2)</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#E0F2FE] p-4 mx-3 mb-4 border border-sky-200/70">
        <p className="text-xs font-semibold text-[#0369A1]">Batas Kerja Sehat</p>
        <p className="text-xs text-slate-700 mt-1 leading-relaxed">
          Acuan <span className="font-semibold">PP No. 35/2021</span>: jam normal{' '}
          <span className="font-semibold tabular-nums">40 jam/minggu</span>, maks lembur{' '}
          <span className="font-semibold tabular-nums">18 jam/minggu</span>.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile/Tablet Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-60 max-w-[80vw] h-full z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[#1E293B] truncate leading-tight">
                {title}
              </h1>
              {breadcrumb && (
                <p className="text-xs text-slate-500 truncate">{breadcrumb}</p>
              )}
            </div>
          </div>

          {onSearchChange && (
            <div className="hidden md:flex items-center relative w-72 lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100 border border-transparent rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none transition"
              />
            </div>
          )}

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#0284C7] text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-[#1E293B] leading-none">{fullName}</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                    ROLE_BADGE_CLASSES[user?.role] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {ROLE_LABELS[user?.role] || user?.role}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
