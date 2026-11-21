import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { getInitials } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/services/api';
import { workLogService } from '@/services/workLogService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';
const NONE_ASSIGNMENT_VALUE = '__none__';

const ASSIGNMENT_STATUS_META = {
  assigned: { label: 'Ditugaskan', tone: 'info' },
  in_progress: { label: 'Dikerjakan', tone: 'warning' },
  completed: { label: 'Selesai', tone: 'success' },
};

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const clean = String(dateString).slice(0, 10);
    return new Date(`${clean}T00:00:00`).toLocaleDateString('id-ID', {
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
      tone: 'neutral',
      indicatorClass: '',
      label: 'Tanpa estimasi',
      width: 0,
    };
  }
  if (actualHours > estimatedHours) {
    return {
      tone: 'warning',
      indicatorClass: '[&_[data-slot=progress-indicator]]:bg-amber-500',
      label: 'Melebihi estimasi — perlu peninjauan',
      width: 100,
    };
  }
  if (rate >= 75) {
    return {
      tone: 'success',
      indicatorClass: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
      label: 'Progres sesuai estimasi',
      width: Math.min(100, Math.max(0, rate)),
    };
  }
  return {
    tone: 'info',
    indicatorClass: '',
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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

  // Detail Sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLog, setDetailLog] = useState(null);

  // Create / Edit Sheet
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [form, setForm] = useState(() => emptyWorkLogForm(defaultEmployeeId));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete ConfirmDialog
  const [deletingLog, setDeletingLog] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      setHasLoadedOnce(true);
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
    () =>
      Boolean(
        search.trim() ||
          assignmentFilter ||
          employeeFilter ||
          departmentFilter ||
          dateFrom ||
          dateTo
      ),
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

  // Eligible assignments shown in Create/Edit sheet for the selected employee
  const modalEligibleAssignments = useMemo(() => {
    const targetEmpId = editingLog
      ? String(editingLog.employee_id)
      : isAdmin && form.employee_id
        ? String(form.employee_id)
        : String(defaultEmployeeId);

    const eligible = assignments.filter((item) => {
      if (item.task?.status === 'cancelled') return false;
      if (!targetEmpId) return true;
      return String(item.employee_id) === targetEmpId;
    });

    if (
      editingLog?.task_assignment &&
      !eligible.some((item) => String(item.id) === String(editingLog.task_assignment_id))
    ) {
      return [
        {
          ...editingLog.task_assignment,
          estimated_hours: editingLog.task_assignment.task?.estimated_hours ?? 0,
          actual_hours: editingLog.hours_spent ?? 0,
        },
        ...eligible,
      ];
    }

    return eligible;
  }, [assignments, editingLog, isAdmin, form.employee_id, defaultEmployeeId]);

  const openDetailSheet = useCallback(async (log) => {
    setDetailLog(log);
    setDetailSheetOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workLogService.getWorkLog(log.id);
      setDetailLog(fresh);
    } catch {
      // Keep list row snapshot if refresh fails
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openCreateSheet = useCallback(
    (prefillAssignment = null) => {
      setEditingLog(null);
      const initialEmp =
        prefillAssignment?.employee_id || defaultEmployeeId || employees[0]?.id || '';
      const initialAssign = prefillAssignment?.id || '';
      setForm(emptyWorkLogForm(initialEmp, initialAssign));
      setFormError('');
      setFormSheetOpen(true);
    },
    [defaultEmployeeId, employees]
  );

  const openEditSheet = useCallback((log) => {
    setEditingLog(log);
    setForm({
      employee_id: log.employee_id ? String(log.employee_id) : '',
      task_assignment_id: log.task_assignment_id ? String(log.task_assignment_id) : '',
      work_date: log.work_date
        ? String(log.work_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      hours_spent: log.hours_spent !== undefined ? String(Number(log.hours_spent)) : '1',
      activity_description: log.activity_description || '',
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const hours = Number(form.hours_spent);
    const desc = form.activity_description.trim();

    if (isAdmin && !editingLog && !form.employee_id) {
      setFormError('Pegawai pelaksana wajib dipilih.');
      return;
    }
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
      ...(!editingLog && isAdmin && form.employee_id
        ? { employee_id: Number(form.employee_id) }
        : {}),
    };

    try {
      if (editingLog) {
        const res = await workLogService.updateWorkLog(editingLog.id, payload);
        toast.success(res.message || 'Catatan work log berhasil diperbarui.');
      } else {
        const res = await workLogService.createWorkLog(payload);
        toast.success(res.message || 'Catatan work log berhasil disimpan.');
      }
      setFormSheetOpen(false);
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
      toast.success(res.message || 'Catatan work log berhasil dihapus.');
      setDeletingLog(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal menghapus catatan work log.').message);
      setDeletingLog(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const weekHours = Number(summary.current_week_hours || 0);
  const weekCardMeta =
    weekHours >= 55
      ? {
          tone: 'danger',
          label: 'Melampaui 55j — Perlu Evaluasi',
        }
      : weekHours > 40
        ? {
            tone: 'warning',
            label: 'Di Atas 40j — Perlu Perhatian',
          }
        : {
            tone: 'success',
            label: 'Dalam Batas Sehat (≤ 40j)',
          };

  const columns = useMemo(() => {
    const cols = [
      {
        accessorKey: 'work_date',
        header: 'Tanggal',
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-xs font-medium text-foreground tabular-nums">
                {formatDate(log.work_date)}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {log.work_date ? String(log.work_date).slice(0, 10) : '-'}
              </span>
            </div>
          );
        },
      },
    ];

    if (!isEmployee) {
      cols.push({
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original.employee || {};
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 max-w-[160px] flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {emp.full_name || '-'}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{emp.employee_code || '-'}</span>
                  {emp.department?.code ? ` · ${emp.department.code}` : ''}
                </span>
              </div>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        accessorFn: (row) => row.task_assignment?.task?.title || 'Aktivitas Umum',
        id: 'task',
        header: 'Tugas Terkait',
        cell: ({ row }) => {
          const task = row.original.task_assignment?.task;
          if (!task) {
            return (
              <div className="whitespace-nowrap">
                <StatusBadge tone="neutral" label="Aktivitas Umum" showDot={false} />
              </div>
            );
          }
          return (
            <div className="flex max-w-[210px] flex-col gap-0.5 whitespace-normal">
              <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                {task.title}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                Estimasi: {formatHours(task.estimated_hours)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'activity_description',
        header: 'Aktivitas Kerja',
        enableSorting: false,
        cell: ({ row }) => (
          <p className="max-w-[240px] line-clamp-2 text-xs leading-relaxed text-muted-foreground whitespace-normal">
            {row.original.activity_description}
          </p>
        ),
      },
      {
        accessorFn: (row) => Number(row.hours_spent || 0),
        id: 'hours_spent',
        header: 'Durasi Aktual',
        cell: ({ row }) => {
          const log = row.original;
          const dailyTotal = Number(log.daily_total_hours ?? log.hours_spent ?? 0);
          const dailyLimit = Number(log.daily_limit_hours ?? 8);
          const exceedsDailyNormal = dailyTotal > dailyLimit;

          return (
            <div className="flex flex-col items-start gap-1 whitespace-nowrap">
              <StatusBadge
                tone="info"
                showDot={false}
                label={formatHours(log.hours_spent)}
                className="font-mono tabular-nums"
              />
              {exceedsDailyNormal && (
                <span className="font-mono text-[11px] font-medium text-amber-700 tabular-nums">
                  Total harian {formatHours(dailyTotal)} (&gt; {formatHours(dailyLimit)})
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetailSheet(log);
                }}
                title="Lihat Detail Work Log"
                aria-label="Lihat Detail Work Log"
              >
                <Eye />
              </Button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditSheet(log);
                    }}
                    title="Edit Work Log"
                    aria-label="Edit Work Log"
                  >
                    <Edit3 />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeletingLog(log);
                    }}
                    title="Hapus Work Log"
                    aria-label="Hapus Work Log"
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          );
        },
      }
    );

    return cols;
  }, [isEmployee, openDetailSheet, openEditSheet, readOnly]);

  const detailDailyTotal = detailLog
    ? Number(detailLog.daily_total_hours ?? detailLog.hours_spent ?? 0)
    : 0;
  const detailDailyLimit = detailLog ? Number(detailLog.daily_limit_hours ?? 8) : 8;
  const detailExceedsDailyNormal = detailDailyTotal > detailDailyLimit;

  return (
    <AppShell
      title="Catatan Waktu Kerja"
      breadcrumb={
        isEmployee
          ? 'Aktivitas & Tugas / Pencatatan Jam Kerja & Realisasi Tugas'
          : 'Operasional Kerja / Pemantauan Jam Aktual vs Estimasi'
      }
      actions={
        !readOnly ? (
          <Button size="sm" onClick={() => openCreateSheet(null)}>
            <Plus data-icon="inline-start" />
            Catat Work Log
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {/* 4 KPI Summary Cards */}
        {loading && !hasLoadedOnce ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label={isEmployee ? 'Total Jam Tercatat Saya' : 'Total Jam Tercatat Tim'}
              value={Number(summary.total_hours_spent || 0).toFixed(1)}
              unit="jam"
              icon={Clock}
              statusTone="info"
              statusLabel={`${summary.total_logs ?? 0} entri aktivitas`}
            />

            <KpiStatCard
              label="Jam Kerja Minggu Berjalan"
              value={weekHours.toFixed(1)}
              unit="jam"
              icon={Calendar}
              progress={Math.min(100, (weekHours / 40) * 100)}
              statusTone={weekCardMeta.tone}
              statusLabel={weekCardMeta.label}
            />

            <KpiStatCard
              label="Estimasi vs Realisasi Tugas"
              value={Number(summary.total_linked_actual_hours || 0).toFixed(1)}
              unit={`/ ${Number(summary.total_estimated_hours || 0).toFixed(1)}j`}
              icon={BarChart3}
              progress={Math.min(100, Math.max(0, Number(summary.overall_realization_rate || 0)))}
              statusTone={Number(summary.overall_realization_rate || 0) > 100 ? 'warning' : 'neutral'}
              statusLabel={`${Number(summary.overall_realization_rate || 0).toFixed(1)}% terealisasi`}
            />

            <KpiStatCard
              label="Hari Melebihi Jam Normal"
              value={summary.overtime_days_count ?? 0}
              unit="hari"
              icon={AlertTriangle}
              statusTone={Number(summary.overtime_days_count || 0) > 0 ? 'warning' : 'success'}
              statusLabel={
                Number(summary.overtime_days_count || 0) > 0
                  ? 'Perlu perhatian'
                  : 'Dalam batas normal'
              }
              hint="8j (5hk) · 7j (6hk)"
            />
          </section>
        )}

        {/* Calm Non-Punitive PP 35/2021 Callout */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">
              Perbandingan Estimasi vs Realisasi &amp; Keseimbangan Jam Kerja:
            </span>{' '}
            {readOnly
              ? 'Pantau perbandingan estimasi jam tugas dan realisasi jam aktual tim secara suportif. Data ini menjadi masukan kalkulasi Workload Risk agar redistribusi tugas dilakukan lebih awal sebelum melampaui batas PP No. 35/2021.'
              : 'Catat durasi kerja aktual harian Anda untuk memantau realisasi dibandingkan estimasi tugas. Pencatatan bersifat transparan sebagai dukungan pengaturan beban kerja, bukan penilaian kinerja punitif.'}
          </p>
        </div>

        {/* Panel 1: Assigned Tasks — Estimation vs Realization Comparison */}
        {!errorMsg && (
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  {isEmployee
                    ? 'Tugas Saya: Perbandingan Estimasi vs Realisasi'
                    : 'Penugasan Tim: Perbandingan Estimasi vs Realisasi'}
                </h2>
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground tabular-nums">
                  {assignments.length}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Bandingkan estimasi tugas dengan jam aktual tercatat pada work log
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                {[1, 2].map((item) => (
                  <Skeleton key={item} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                Belum ada penugasan tugas dalam cakupan filter saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                {assignments.map((assign) => {
                  const statusMeta =
                    ASSIGNMENT_STATUS_META[assign.status] || ASSIGNMENT_STATUS_META.assigned;
                  const realizationMeta = getRealizationMeta(
                    assign.realization_rate,
                    assign.actual_hours,
                    assign.estimated_hours
                  );
                  const varianceSign = assign.variance_hours > 0 ? '+' : '';

                  return (
                    <div
                      key={assign.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:bg-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              tone={statusMeta.tone}
                              label={statusMeta.label}
                              className="px-2 py-0 text-[11px]"
                            />
                            {assign.task?.department && (
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                {assign.task.department.code}
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              Tenggat: {formatDate(assign.deadline)}
                            </span>
                          </div>
                          <h3 className="truncate text-sm font-medium text-foreground">
                            {assign.task?.title || 'Tugas'}
                          </h3>
                          {!isEmployee && assign.employee && (
                            <p className="text-xs text-muted-foreground">
                              Pelaksana:{' '}
                              <span className="font-medium text-foreground">
                                {assign.employee.full_name}
                              </span>{' '}
                              <span className="font-mono text-[11px]">
                                ({assign.employee.employee_code})
                              </span>
                            </p>
                          )}
                        </div>

                        {!readOnly && assign.task?.status !== 'cancelled' && (
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => openCreateSheet(assign)}
                            className="shrink-0"
                          >
                            <Plus data-icon="inline-start" />
                            Catat Log
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground tabular-nums">
                            <span>
                              Est:{' '}
                              <strong className="font-semibold text-foreground">
                                {formatHours(assign.estimated_hours)}
                              </strong>
                            </span>
                            <span>
                              Aktual:{' '}
                              <strong className="font-semibold text-foreground">
                                {formatHours(assign.actual_hours)}
                              </strong>
                            </span>
                            <span>
                              Selisih:{' '}
                              <strong
                                className={cn(
                                  'font-semibold',
                                  assign.variance_hours > 0
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                )}
                              >
                                {varianceSign}
                                {formatHours(assign.variance_hours)}
                              </strong>
                            </span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                            {Number(assign.realization_rate || 0).toFixed(1)}%
                          </span>
                        </div>

                        <Progress
                          value={realizationMeta.width}
                          className={cn('h-1.5', realizationMeta.indicatorClass)}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge
                            tone={realizationMeta.tone}
                            label={realizationMeta.label}
                            showDot={false}
                            className="px-2 py-0 text-[11px]"
                          />
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
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

        {/* Panel 2: Daily Work Logs History DataTable */}
        <DataTable
          title={isEmployee ? 'Riwayat Catatan Waktu Kerja Saya' : 'Riwayat Work Log Harian Tim'}
          countLabel="catatan"
          columns={columns}
          data={workLogs}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari aktivitas, nama tugas, atau pegawai..."
          pageSize={10}
          onRowClick={(log) => openDetailSheet(log)}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak Ada Work Log Sesuai Filter'
              : 'Belum Ada Catatan Waktu Kerja'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Ubah kata kunci, penugasan, atau rentang tanggal untuk melihat catatan lainnya.'
              : readOnly
                ? 'Pegawai belum mencatat aktivitas work log harian.'
                : 'Catat aktivitas dan jam kerja aktual harian Anda untuk membandingkannya dengan estimasi tugas.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" onClick={() => openCreateSheet(null)}>
                  <Plus data-icon="inline-start" />
                  Catat Work Log
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="task_assignment_filter"
                value={assignmentFilter || ALL_VALUE}
                onValueChange={(val) => setAssignmentFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="wl-filter-assignment"
                  size="sm"
                  aria-label="Filter penugasan tugas"
                  className="w-52 bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Penugasan Tugas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Penugasan Tugas</SelectItem>
                    {assignments.map((assign) => (
                      <SelectItem key={assign.id} value={String(assign.id)}>
                        {assign.task?.title || `Penugasan #${assign.id}`}
                        {!isEmployee && assign.employee ? ` — ${assign.employee.full_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {!isEmployee && (
                <>
                  <Select
                    name="department_filter"
                    value={departmentFilter || ALL_VALUE}
                    onValueChange={(val) => setDepartmentFilter(val === ALL_VALUE ? '' : val)}
                  >
                    <SelectTrigger
                      id="wl-filter-department"
                      size="sm"
                      aria-label="Filter departemen"
                      className="w-44 bg-background text-xs"
                    >
                      <SelectValue placeholder="Semua Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.code} — {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    name="employee_filter"
                    value={employeeFilter || ALL_VALUE}
                    onValueChange={(val) => setEmployeeFilter(val === ALL_VALUE ? '' : val)}
                  >
                    <SelectTrigger
                      id="wl-filter-employee"
                      size="sm"
                      aria-label="Filter pegawai"
                      className="w-48 bg-background text-xs"
                    >
                      <SelectValue placeholder="Semua Pegawai" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Pegawai</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.employee_code} — {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Label htmlFor="wl-filter-date-from" className="text-xs font-normal text-muted-foreground">
                  Dari
                </Label>
                <Input
                  id="wl-filter-date-from"
                  name="date_from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Tanggal mulai"
                  className="h-7 w-34 bg-background font-mono text-xs tabular-nums"
                />
                <span>s.d.</span>
                <Input
                  id="wl-filter-date-to"
                  name="date_to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Tanggal akhir"
                  className="h-7 w-34 bg-background font-mono text-xs tabular-nums"
                />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Reset
                </Button>
              )}
            </div>
          }
          actionsSlot={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={loadAllData}
              aria-label="Muat ulang data"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          }
        />
      </div>

      {/* Sheet 1: Detail Work Log */}
      <FormSheet
        open={detailSheetOpen && Boolean(detailLog)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Catatan Waktu Kerja"
        description={
          detailLog
            ? `ID Log #${detailLog.id} · Tanggal ${formatDate(detailLog.work_date)}`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Tutup
            </Button>
            {!readOnly && detailLog && (
              <Button
                type="button"
                onClick={() => {
                  const target = detailLog;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 data-icon="inline-start" />
                Edit Catatan
              </Button>
            )}
          </>
        }
      >
        {detailLog && (
          <div className="flex flex-col gap-5">
            {detailLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                <span>Menyegarkan detail catatan...</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-card text-xs font-semibold text-foreground">
                    {getInitials(detailLog.employee?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] text-muted-foreground">Pegawai</span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {detailLog.employee?.full_name || '-'}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{detailLog.employee?.employee_code || ''}</span>
                    {detailLog.employee?.department?.name
                      ? ` · ${detailLog.employee.department.name}`
                      : ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border bg-muted/30 p-3.5">
                <span className="text-[11px] text-muted-foreground">Durasi Kerja Aktual</span>
                <span className="font-mono text-2xl font-semibold text-primary tabular-nums">
                  {Number(detailLog.hours_spent || 0)
                    .toFixed(2)
                    .replace(/\.?0+$/, '')}{' '}
                  <span className="text-xs font-normal text-muted-foreground">jam</span>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  Tanggal: {detailLog.work_date ? String(detailLog.work_date).slice(0, 10) : '-'}
                </span>
              </div>
            </div>

            {detailExceedsDailyNormal && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Total catatan harian mencapai{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatHours(detailDailyTotal)}
                  </span>{' '}
                  (melebihi batas normal harian{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatHours(detailDailyLimit)}
                  </span>
                  ).
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/20 p-4">
              <span className="text-xs text-muted-foreground">Penugasan Tugas Terkait</span>
              {detailLog.task_assignment?.task ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {detailLog.task_assignment.task.title}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    Estimasi Tugas: {formatHours(detailLog.task_assignment.task.estimated_hours)} ·
                    Tenggat: {formatDate(detailLog.task_assignment.deadline)}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Aktivitas Umum / Non-Penugasan
                </span>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">Deskripsi Aktivitas</span>
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {detailLog.activity_description}
              </div>
            </div>
          </div>
        )}
      </FormSheet>

      {/* Sheet 2: Create / Edit Work Log */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={(open) => {
          if (!submitting) setFormSheetOpen(open);
        }}
        title={editingLog ? 'Edit Catatan Work Log' : 'Catat Waktu Kerja Aktual'}
        description="Dokumentasikan durasi jam kerja dan aktivitas untuk perbandingan realisasi."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormSheetOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" form="work-log-form" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingLog
                  ? 'Simpan Perubahan'
                  : 'Simpan Work Log'}
            </Button>
          </>
        }
      >
        <form id="work-log-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {isAdmin && !editingLog && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-employee" className="text-xs">
                Pegawai Pelaksana <span className="text-destructive">*</span>
              </Label>
              <Select
                name="employee_id"
                value={form.employee_id || undefined}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    employee_id: val,
                    task_assignment_id: '',
                  }))
                }
              >
                <SelectTrigger id="wl-employee" className="w-full">
                  <SelectValue placeholder="Pilih pegawai..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.employee_code} — {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-assignment" className="text-xs">
              Penugasan Tugas (Opsional)
            </Label>
            <Select
              name="task_assignment_id"
              value={form.task_assignment_id || NONE_ASSIGNMENT_VALUE}
              onValueChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  task_assignment_id: val === NONE_ASSIGNMENT_VALUE ? '' : val,
                }))
              }
            >
              <SelectTrigger id="wl-assignment" className="w-full">
                <SelectValue placeholder="Aktivitas Umum (Tanpa tautan tugas)" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NONE_ASSIGNMENT_VALUE}>
                    Aktivitas Umum (Tanpa tautan tugas)
                  </SelectItem>
                  {modalEligibleAssignments.map((assign) => (
                    <SelectItem key={assign.id} value={String(assign.id)}>
                      {assign.task?.title || `Penugasan #${assign.id}`} (Est:{' '}
                      {formatHours(assign.estimated_hours)}, Aktual:{' '}
                      {formatHours(assign.actual_hours)})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-work-date" className="text-xs">
                Tanggal Kerja <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wl-work-date"
                name="work_date"
                type="date"
                required
                value={form.work_date}
                onChange={(e) => setForm((prev) => ({ ...prev, work_date: e.target.value }))}
                className="font-mono tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-hours-spent" className="text-xs">
                Durasi Aktual (Jam) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wl-hours-spent"
                name="hours_spent"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                value={form.hours_spent}
                onChange={(e) => setForm((prev) => ({ ...prev, hours_spent: e.target.value }))}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-activity-description" className="text-xs">
              Deskripsi Aktivitas Kerja <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="wl-activity-description"
              name="activity_description"
              rows={4}
              required
              value={form.activity_description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, activity_description: e.target.value }))
              }
              placeholder="Tuliskan aktivitas yang dikerjakan, progres modul, atau hasil pekerjaan hari ini..."
            />
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              Minimal 5 karakter ({form.activity_description.trim().length} karakter tertulis).
            </span>
          </div>
        </form>
      </FormSheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingLog)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingLog(null);
        }}
        title="Hapus Catatan Work Log?"
        description={
          deletingLog ? (
            <>
              Anda akan menghapus catatan tanggal{' '}
              <span className="font-medium text-foreground">
                {formatDate(deletingLog.work_date)}
              </span>{' '}
              berdurasi{' '}
              <span className="font-mono font-medium text-foreground">
                {formatHours(deletingLog.hours_spent)}
              </span>
              . Tindakan ini akan memperbarui total jam realisasi tugas.
            </>
          ) : undefined
        }
        confirmLabel="Ya, Hapus Catatan"
        cancelLabel="Batal"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
