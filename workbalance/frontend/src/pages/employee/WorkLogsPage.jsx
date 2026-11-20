import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../services/api';
import { workLogService } from '../../services/workLogService';

const ASSIGNMENT_STATUS_STYLES = {
  assigned: { label: 'Ditugaskan', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  in_progress: { label: 'Dikerjakan', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  completed: { label: 'Selesai', badgeClass: 'bg-[#D1FAE5] text-[#047857]' },
};

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatHours(value) {
  const num = Number(value || 0);
  return `${Number.isInteger(num) ? num : num.toFixed(2).replace(/\.?0+$/, '')}j`;
}

function getRealizationMeta(rate, actualHours, estimatedHours) {
  if (!estimatedHours || estimatedHours <= 0) {
    return {
      barClass: 'bg-[#0284C7]',
      badgeClass: 'bg-slate-100 text-slate-600',
      label: 'Tanpa estimasi',
      width: 0,
    };
  }
  if (actualHours > estimatedHours) {
    return {
      barClass: 'bg-[#F59E0B]',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
      label: 'Melebihi estimasi — perlu peninjauan',
      width: 100,
    };
  }
  if (rate >= 75) {
    return {
      barClass: 'bg-[#10B981]',
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      label: 'Progres sesuai estimasi',
      width: Math.min(100, Math.max(0, rate)),
    };
  }
  return {
    barClass: 'bg-[#0284C7]',
    badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
    label: 'Dalam pengerjaan',
    width: Math.min(100, Math.max(0, rate)),
  };
}

function emptyWorkLogForm(defaultEmployeeId = '', defaultAssignmentId = '') {
  return {
    employee_id: defaultEmployeeId ? String(defaultEmployeeId) : '',
    task_assignment_id: defaultAssignmentId ? String(defaultAssignmentId) : '',
    work_date: new Date().toISOString().slice(0, 10),
    hours_spent: '2',
    activity_description: '',
  };
}

export default function WorkLogsPage({ readOnly = false }) {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const isAdmin = user?.role === 'admin';
  const defaultEmployeeId = user?.employee?.id || '';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [workLogs, setWorkLogs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    total_logs: 0,
    total_hours_spent: 0,
    current_week_hours: 0,
    total_estimated_hours: 0,
    total_linked_actual_hours: 0,
    overall_realization_rate: 0,
    overtime_days_count: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLog, setDetailLog] = useState(null);

  // Create / Edit Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [form, setForm] = useState(() => emptyWorkLogForm(defaultEmployeeId));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal
  const [deletingLog, setDeletingLog] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await workLogService.getWorkLogs({
        search: search.trim(),
        task_assignment_id: assignmentFilter,
        employee_id: employeeFilter,
        department_id: departmentFilter,
        date_from: dateFrom,
        date_to: dateTo,
      });

      setWorkLogs(data?.work_logs || []);
      setAssignments(data?.assignments || []);
      setDepartments(data?.departments || []);
      setEmployees(data?.employees || []);
      setSummary(
        data?.summary || {
          total_logs: 0,
          total_hours_spent: 0,
          current_week_hours: 0,
          total_estimated_hours: 0,
          total_linked_actual_hours: 0,
          overall_realization_rate: 0,
          overtime_days_count: 0,
        }
      );
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data work log dan realisasi kerja.').message);
    } finally {
      setLoading(false);
    }
  }, [search, assignmentFilter, employeeFilter, departmentFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || assignmentFilter || employeeFilter || departmentFilter || dateFrom || dateTo),
    [search, assignmentFilter, employeeFilter, departmentFilter, dateFrom, dateTo]
  );

  const resetFilters = () => {
    setSearch('');
    setAssignmentFilter('');
    setEmployeeFilter('');
    setDepartmentFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Eligible assignments shown in Create/Edit modal for the selected employee
  const modalEligibleAssignments = useMemo(() => {
    const targetEmpId = editingLog
      ? String(editingLog.employee_id)
      : isAdmin && form.employee_id
        ? String(form.employee_id)
        : String(defaultEmployeeId);

    return assignments.filter((item) => {
      if (item.task?.status === 'cancelled') return false;
      if (!targetEmpId) return true;
      return String(item.employee_id) === targetEmpId;
    });
  }, [assignments, editingLog, isAdmin, form.employee_id, defaultEmployeeId]);

  const openDetailModal = async (log) => {
    setDetailLog(log);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workLogService.getWorkLog(log.id);
      setDetailLog(fresh);
    } catch {
      // Keep list row snapshot if refresh fails
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreateModal = (prefillAssignment = null) => {
    setEditingLog(null);
    const initialEmp = prefillAssignment?.employee_id || defaultEmployeeId || employees[0]?.id || '';
    const initialAssign = prefillAssignment?.id || '';
    setForm(emptyWorkLogForm(initialEmp, initialAssign));
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (log) => {
    setEditingLog(log);
    setForm({
      employee_id: log.employee_id ? String(log.employee_id) : '',
      task_assignment_id: log.task_assignment_id ? String(log.task_assignment_id) : '',
      work_date: log.work_date || new Date().toISOString().slice(0, 10),
      hours_spent: log.hours_spent !== undefined ? String(Number(log.hours_spent)) : '1',
      activity_description: log.activity_description || '',
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const hours = Number(form.hours_spent);
    const desc = form.activity_description.trim();

    if (!form.work_date) {
      setFormError('Tanggal kerja wajib diisi.');
      return;
    }
    if (Number.isNaN(hours) || hours < 0.25 || hours > 24) {
      setFormError('Durasi jam kerja aktual harus antara 0.25 hingga 24 jam.');
      return;
    }
    if (desc.length < 5) {
      setFormError('Deskripsi aktivitas minimal 5 karakter.');
      return;
    }

    setSubmitting(true);
    const payload = {
      task_assignment_id: form.task_assignment_id ? Number(form.task_assignment_id) : null,
      work_date: form.work_date,
      hours_spent: hours,
      activity_description: desc,
      ...(!editingLog && isAdmin && form.employee_id ? { employee_id: Number(form.employee_id) } : {}),
    };

    try {
      if (editingLog) {
        const res = await workLogService.updateWorkLog(editingLog.id, payload);
        showToast('success', res.message || 'Catatan work log berhasil diperbarui.');
      } else {
        const res = await workLogService.createWorkLog(payload);
        showToast('success', res.message || 'Catatan work log berhasil disimpan.');
      }
      setFormModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan catatan work log.').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    setDeleteLoading(true);
    try {
      const res = await workLogService.deleteWorkLog(deletingLog.id);
      showToast('success', res.message || 'Catatan work log berhasil dihapus.');
      setDeletingLog(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal menghapus catatan work log.').message);
      setDeletingLog(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const weekHours = Number(summary.current_week_hours || 0);
  const weekCardStyle =
    weekHours >= 55
      ? {
          badge: 'Melampaui Ambang 55j — Perlu Evaluasi',
          badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
          iconBg: 'bg-[#FEE2E2] text-[#EF4444]',
        }
      : weekHours > 40
        ? {
            badge: 'Di Atas 40j Normal — Perlu Perhatian',
            badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
            iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
          }
        : {
            badge: 'Dalam Batas Sehat (≤ 40j/minggu)',
            badgeClass: 'bg-[#D1FAE5] text-[#047857]',
            iconBg: 'bg-[#D1FAE5] text-[#10B981]',
          };

  const kpiCards = [
    {
      label: isEmployee ? 'Total Jam Tercatat Saya' : 'Total Jam Tercatat Tim',
      value: `${Number(summary.total_hours_spent || 0).toFixed(1)} jam`,
      badge: `${summary.total_logs ?? 0} entri aktivitas kerja`,
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Clock,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Jam Kerja Minggu Berjalan',
      value: `${weekHours.toFixed(1)} jam`,
      badge: weekCardStyle.badge,
      badgeClass: weekCardStyle.badgeClass,
      icon: Calendar,
      iconBg: weekCardStyle.iconBg,
    },
    {
      label: 'Estimasi vs Realisasi Tugas',
      value: `${Number(summary.total_linked_actual_hours || 0).toFixed(1)} / ${Number(
        summary.total_estimated_hours || 0
      ).toFixed(1)} j`,
      badge: `${Number(summary.overall_realization_rate || 0).toFixed(1)}% terealisasi`,
      badgeClass: 'bg-slate-100 text-slate-700',
      icon: BarChart3,
      iconBg: 'bg-slate-100 text-[#1E293B]',
    },
    {
      label: 'Hari Melebihi Jam Normal',
      value: `${summary.overtime_days_count ?? 0} hari`,
      badge: 'Acuan normal harian: 8j (5hk) · 7j (6hk)',
      badgeClass:
        Number(summary.overtime_days_count || 0) > 0
          ? 'bg-[#FEF3C7] text-[#B45309]'
          : 'bg-[#D1FAE5] text-[#047857]',
      icon: AlertTriangle,
      iconBg:
        Number(summary.overtime_days_count || 0) > 0
          ? 'bg-[#FEF3C7] text-[#F59E0B]'
          : 'bg-[#D1FAE5] text-[#10B981]',
    },
  ];

  return (
    <AppShell
      title="Catatan Waktu Kerja (Work Log)"
      breadcrumb={
        isEmployee
          ? 'Aktivitas Kerja / Pencatatan Jam Kerja & Realisasi Tugas'
          : 'Aktivitas Kerja / Monitoring Jam Aktual vs Estimasi / PBI-09'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari aktivitas, nama tugas, atau pegawai..."
    >
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 max-w-md flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg border ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-[#047857]'
              : 'bg-white border-red-200 text-[#B91C1C]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium text-[#1E293B] flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* 4 KPI Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-[#1E293B] tabular-nums mt-2">
                  {card.value}
                </p>
                <span
                  className={`inline-block mt-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${card.badgeClass}`}
                >
                  {card.badge}
                </span>
              </div>
            );
          })}
        </section>

        {/* Non-punitive PP 35/2021 Callout */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs text-[#0369A1]">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
          <p className="leading-relaxed">
            <span className="font-semibold">Perbandingan Estimasi vs Realisasi & Keseimbangan Jam Kerja:</span>{' '}
            {readOnly
              ? 'Pantau perbandingan estimasi jam tugas dan realisasi jam aktual tim secara suportif. Data ini menjadi masukan kalkulasi Workload Risk agar redistribusi tugas dilakukan lebih awal sebelum melampaui batas PP No. 35/2021.'
              : 'Catat durasi kerja aktual harian Anda untuk memantau realisasi dibandingkan estimasi tugas. Pencatatan bersifat transparan sebagai dukungan pengaturan beban kerja, bukan penilaian kinerja punitif.'}
          </p>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Work Log</h2>
                <p className="text-sm text-slate-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-semibold transition cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {/* Panel 1: Assigned Tasks — Estimation vs Realization Comparison */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-[#0284C7]" />
                <h2 className="text-base font-semibold text-[#1E293B]">
                  {isEmployee
                    ? 'Tugas Saya: Perbandingan Estimasi vs Realisasi'
                    : 'Penugasan Tim: Perbandingan Estimasi vs Realisasi'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {assignments.length}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Bandingkan estimasi tugas dengan jam aktual tercatat pada work log
              </span>
            </div>

            {loading ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((item) => (
                  <div key={item} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada penugasan tugas dalam cakupan filter saat ini.
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {assignments.map((assign) => {
                  const statusMeta =
                    ASSIGNMENT_STATUS_STYLES[assign.status] || ASSIGNMENT_STATUS_STYLES.assigned;
                  const realizationMeta = getRealizationMeta(
                    assign.realization_rate,
                    assign.actual_hours,
                    assign.estimated_hours
                  );
                  const varianceSign = assign.variance_hours > 0 ? '+' : '';

                  return (
                    <div
                      key={assign.id}
                      className="rounded-xl border border-slate-200/80 p-4 bg-slate-50/40 hover:bg-white transition flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                            {assign.task?.department && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold">
                                {assign.task.department.code}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              Tenggat: {formatDate(assign.deadline)}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-[#1E293B] mt-1.5 truncate">
                            {assign.task?.title || 'Tugas'}
                          </h3>
                          {!isEmployee && assign.employee && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Pelaksana:{' '}
                              <span className="font-medium text-slate-700">
                                {assign.employee.full_name}
                              </span>{' '}
                              <span className="font-mono text-[11px]">
                                ({assign.employee.employee_code})
                              </span>
                            </p>
                          )}
                        </div>

                        {!readOnly && assign.task?.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => openCreateModal(assign)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold shrink-0 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Catat Log</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 tabular-nums text-slate-600">
                            <span>
                              Estimasi:{' '}
                              <strong className="text-[#1E293B]">
                                {formatHours(assign.estimated_hours)}
                              </strong>
                            </span>
                            <span>
                              Aktual:{' '}
                              <strong className="text-[#1E293B]">
                                {formatHours(assign.actual_hours)}
                              </strong>
                            </span>
                            <span>
                              Selisih:{' '}
                              <strong
                                className={
                                  assign.variance_hours > 0 ? 'text-[#B45309]' : 'text-[#047857]'
                                }
                              >
                                {varianceSign}
                                {formatHours(assign.variance_hours)}
                              </strong>
                            </span>
                          </div>
                          <span className="font-semibold text-[#1E293B] tabular-nums">
                            {Number(assign.realization_rate || 0).toFixed(1)}%
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${realizationMeta.barClass}`}
                            style={{ width: `${realizationMeta.width}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-medium ${realizationMeta.badgeClass}`}
                          >
                            {realizationMeta.label}
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            {assign.work_logs_count} catatan log
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Panel 2: Daily Work Logs History & Filter Table */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold text-[#1E293B]">
                    {isEmployee ? 'Riwayat Catatan Waktu Kerja Saya' : 'Riwayat Work Log Harian Tim'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                    {workLogs.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadAllData}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
                    title="Muat ulang data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(null)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Catat Work Log</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari aktivitas / tugas..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                <select
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none max-w-xs"
                  aria-label="Filter penugasan tugas"
                >
                  <option value="">Semua Penugasan Tugas</option>
                  {assignments.map((assign) => (
                    <option key={assign.id} value={assign.id}>
                      {assign.task?.title || `Penugasan #${assign.id}`}
                      {!isEmployee && assign.employee ? ` — ${assign.employee.full_name}` : ''}
                    </option>
                  ))}
                </select>

                {!isEmployee && (
                  <>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                      aria-label="Filter departemen"
                    >
                      <option value="">Semua Departemen</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.code} — {dept.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={employeeFilter}
                      onChange={(e) => setEmployeeFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                      aria-label="Filter pegawai"
                    >
                      <option value="">Semua Pegawai</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employee_code} — {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Dari:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    aria-label="Tanggal mulai"
                  />
                  <span>s.d.</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    aria-label="Tanggal akhir"
                  />
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : workLogs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B] mt-3">
                  {hasActiveFilters
                    ? 'Tidak Ada Work Log Sesuai Filter'
                    : 'Belum Ada Catatan Waktu Kerja'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Ubah kata kunci, penugasan, atau rentang tanggal untuk melihat catatan lainnya.'
                    : readOnly
                      ? 'Pegawai belum mencatat aktivitas work log harian.'
                      : 'Catat aktivitas dan jam kerja aktual harian Anda untuk membandingkannya dengan estimasi tugas.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(null)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Catat Work Log</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Tanggal</th>
                      {!isEmployee && <th className="py-3 px-4">Pegawai</th>}
                      <th className="py-3 px-4">Tugas Terkait</th>
                      <th className="py-3 px-4">Aktivitas Kerja</th>
                      <th className="py-3 px-4">Durasi Aktual</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {workLogs.map((log) => {
                      const dailyTotal = Number(log.daily_total_hours ?? log.hours_spent ?? 0);
                      const dailyLimit = Number(log.daily_limit_hours ?? 8);
                      const exceedsDailyNormal = dailyTotal > dailyLimit;

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition align-top">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="text-xs font-semibold text-[#1E293B] tabular-nums">
                              {formatDate(log.work_date)}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {log.work_date}
                            </p>
                          </td>

                          {!isEmployee && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="text-xs font-semibold text-[#1E293B]">
                                {log.employee?.full_name || '-'}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono">
                                  {log.employee?.employee_code || '-'}
                                </span>
                                {log.employee?.department?.code
                                  ? ` · ${log.employee.department.code}`
                                  : ''}
                              </p>
                            </td>
                          )}

                          <td className="py-3.5 px-4 max-w-xs">
                            {log.task_assignment?.task ? (
                              <div>
                                <p className="text-xs font-semibold text-[#1E293B] line-clamp-1">
                                  {log.task_assignment.task.title}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                  Estimasi tugas: {formatHours(log.task_assignment.task.estimated_hours)}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                Aktivitas Umum
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-sm">
                            <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                              {log.activity_description}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] tabular-nums">
                              {formatHours(log.hours_spent)}
                            </span>
                            {exceedsDailyNormal && (
                              <p className="text-[11px] text-[#B45309] font-medium mt-1 tabular-nums">
                                Total harian {formatHours(dailyTotal)} (&gt; {formatHours(dailyLimit)})
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(log)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                title="Lihat detail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detail</span>
                              </button>

                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(log)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-[#E0F2FE]/60 text-[#0369A1] hover:bg-[#E0F2FE] text-xs font-medium transition cursor-pointer"
                                    title="Edit work log"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingLog(log)}
                                    className="p-1.5 rounded-lg border border-red-200 text-[#EF4444] hover:bg-[#FEE2E2]/60 transition cursor-pointer"
                                    title="Hapus work log"
                                    aria-label="Hapus work log"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal 1: Detail Work Log */}
      {detailModalOpen && detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">Detail Catatan Waktu Kerja</h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  ID Log #{detailLog.id} · Tanggal {formatDate(detailLog.work_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {detailLoading && (
                <p className="text-xs text-slate-400">Menyegarkan detail catatan...</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Pegawai</p>
                  <p className="text-sm font-semibold text-[#1E293B] mt-1">
                    {detailLog.employee?.full_name || '-'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {detailLog.employee?.employee_code || ''}{' '}
                    {detailLog.employee?.department?.name
                      ? `· ${detailLog.employee.department.name}`
                      : ''}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Durasi Kerja Aktual</p>
                  <p className="text-lg font-bold text-[#0284C7] mt-1 tabular-nums">
                    {Number(detailLog.hours_spent || 0).toFixed(2).replace(/\.?0+$/, '')} jam
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tanggal: {detailLog.work_date}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium">Penugasan Tugas Terkait</p>
                {detailLog.task_assignment?.task ? (
                  <div className="mt-1">
                    <p className="text-sm font-semibold text-[#1E293B]">
                      {detailLog.task_assignment.task.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Estimasi Tugas: {formatHours(detailLog.task_assignment.task.estimated_hours)}{' '}
                      · Tenggat: {formatDate(detailLog.task_assignment.deadline)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-600 mt-1">
                    Aktivitas Umum / Non-Penugasan
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Deskripsi Aktivitas
                </p>
                <div className="mt-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {detailLog.activity_description}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openEditModal(detailLog);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Catatan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Catat / Edit Work Log */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  {editingLog ? 'Edit Catatan Work Log' : 'Catat Waktu Kerja Aktual'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dokumentasikan durasi jam kerja dan aktivitas untuk perbandingan realisasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEE2E2] text-[#B91C1C] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {isAdmin && !editingLog && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pegawai Pelaksana <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={form.employee_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        employee_id: e.target.value,
                        task_assignment_id: '',
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  >
                    <option value="">Pilih pegawai...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.employee_code} — {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Penugasan Tugas (Opsional)
                </label>
                <select
                  value={form.task_assignment_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, task_assignment_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Aktivitas Umum (Tanpa tautan tugas)</option>
                  {modalEligibleAssignments.map((assign) => (
                    <option key={assign.id} value={String(assign.id)}>
                      {assign.task?.title || `Penugasan #${assign.id}`} (Est:{' '}
                      {formatHours(assign.estimated_hours)}, Aktual:{' '}
                      {formatHours(assign.actual_hours)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tanggal Kerja <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.work_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, work_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Durasi Aktual (Jam) <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={form.hours_spent}
                    onChange={(e) => setForm((prev) => ({ ...prev, hours_spent: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deskripsi Aktivitas Kerja <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={form.activity_description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, activity_description: e.target.value }))
                  }
                  placeholder="Tuliskan aktivitas yang dikerjakan, progres modul, atau hasil pekerjaan hari ini..."
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                  Minimal 5 karakter ({form.activity_description.trim().length} karakter tertulis).
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {submitting
                    ? 'Menyimpan...'
                    : editingLog
                      ? 'Simpan Perubahan'
                      : 'Simpan Work Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Konfirmasi Hapus */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">Hapus Catatan Work Log?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Anda akan menghapus catatan tanggal{' '}
                  <span className="font-semibold text-[#1E293B]">
                    {formatDate(deletingLog.work_date)}
                  </span>{' '}
                  berdurasi{' '}
                  <span className="font-semibold text-[#1E293B]">
                    {formatHours(deletingLog.hours_spent)}
                  </span>
                  . Tindakan ini akan memperbarui total jam realisasi tugas.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus Catatan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
