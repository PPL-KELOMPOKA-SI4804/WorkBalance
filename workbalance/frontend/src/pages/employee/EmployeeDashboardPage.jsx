import { Briefcase, Building2, Calendar, Clock, UserCheck } from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const employee = user?.employee;

  return (
    <AppShell title="Beranda Pegawai" breadcrumb="Workspace Pegawai / Profil Kepegawaian">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">
                <UserCheck className="w-3.5 h-3.5" />
                Status Aktif
              </span>
              <h2 className="text-xl font-bold text-[#1E293B] mt-2">
                {employee?.full_name || user?.email}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {employee?.position?.title || 'Pegawai'} • {employee?.department?.name || 'Departemen'}
              </p>
            </div>
            <div className="rounded-lg bg-[#E0F2FE] px-4 py-3 border border-sky-200/70">
              <p className="text-xs font-semibold text-[#0369A1]">Kode Pegawai</p>
              <p className="text-lg font-bold text-[#1E293B] tabular-nums">
                {employee?.employee_code || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Departemen</p>
                <p className="text-sm font-semibold text-[#1E293B]">
                  {employee?.department?.name || '-'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#D1FAE5] text-[#047857] flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Jenis Kepegawaian</p>
                <p className="text-sm font-semibold text-[#1E293B]">
                  {employee?.employment_type?.name || '-'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Standar Jam Kerja</p>
                <p className="text-sm font-semibold text-[#1E293B] tabular-nums">
                  {employee?.employment_type
                    ? `${employee.employment_type.work_days_per_week} hari / ${employee.employment_type.normal_weekly_hours} jam per minggu`
                    : '40 jam per minggu'}
                </p>
              </div>
            </div>
          </div>

          {employee?.join_date && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Tanggal bergabung: <span className="font-medium tabular-nums">{employee.join_date}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
