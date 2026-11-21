import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { taskService } from '@/services/taskService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const PRIORITY_META = {
  critical: { label: 'Kritis', tone: 'danger' },
  high: { label: 'Tinggi', tone: 'warning' },
  medium: { label: 'Sedang', tone: 'info' },
  low: { label: 'Rendah', tone: 'neutral' },
};

const TASK_STATUS_META = {
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

const ASSIGNMENT_STATUS_META = {
  assigned: { label: 'Assigned', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
};

function getDeadlineIndicator(dueDateStr, status) {
  if (!dueDateStr || status === 'completed' || status === 'cancelled') {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(dueDateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Lewat ${Math.abs(diffDays)} hari`,
      tone: 'danger',
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Jatuh tempo hari ini',
      tone: 'warning',
    };
  }

  if (diffDays <= 7) {
    return {
      text: `H-${diffDays}`,
      tone: 'warning',
    };
  }

  return null;
}

function emptyTaskForm(departments = []) {
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);

  return {
    title: '',
    department_id: departments[0]?.id ? String(departments[0].id) : '',
    estimated_hours: '8',
    priority: 'medium',
    due_date: defaultDueDate.toISOString().slice(0, 10),
    status: 'open',
    description: '',
  };
}

export default function TasksPage({ readOnly = false }) {
  const prefersReducedMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    completed: 0,
    total_active_estimated_hours: 0,
    deadline_pressure_count: 0,
  });
  const [departments, setDepartments] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');

  // Detail Sheet State
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Create / Edit Sheet State
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(() => emptyTaskForm([]));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete ConfirmDialog State
  const [deletingTask, setDeletingTask] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [tasksRes, deptsRes] = await Promise.all([
        taskService.getTasks({
          search: search.trim(),
          status: statusFilter,
          priority: priorityFilter,
          department_id: departmentFilter,
          due_filter: dueFilter,
        }),
        !readOnly ? departmentService.getDepartments() : Promise.resolve(null),
      ]);

      const taskList = tasksRes?.tasks || [];
      setTasks(taskList);
      setSummary(
        tasksRes?.summary || {
          total: 0,
          active: 0,
          completed: 0,
          total_active_estimated_hours: 0,
          deadline_pressure_count: 0,
        }
      );

      if (Array.isArray(deptsRes)) {
        setDepartments(deptsRes);
      } else {
        setDepartments((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          taskList.forEach((task) => {
            if (task.department) {
              map.set(task.department.id, task.department);
            }
          });
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      }
      setHasLoadedOnce(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data tugas organisasi.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, departmentFilter, dueFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        search.trim() || statusFilter || priorityFilter || departmentFilter || dueFilter
      ),
    [search, statusFilter, priorityFilter, departmentFilter, dueFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setDepartmentFilter('');
    setDueFilter('');
  };

  // --- Detail Handler ---
  const openDetailSheet = useCallback(async (task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
    setDetailLoading(true);

    try {
      const detail = await taskService.getTask(task.id);
      setSelectedTask(detail);
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal memuat detail tugas.').message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // --- Create / Edit Handlers ---
  const openCreateSheet = useCallback(() => {
    setEditingTask(null);
    setForm(emptyTaskForm(departments));
    setFormError('');
    setFormSheetOpen(true);
  }, [departments]);

  const openEditSheet = useCallback((task) => {
    setEditingTask(task);
    setForm({
      title: task.title || '',
      department_id: task.department_id ? String(task.department_id) : '',
      estimated_hours: String(Number(task.estimated_hours || 1)),
      priority: task.priority || 'medium',
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : '',
      status: task.status || 'open',
      description: task.description || '',
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const title = form.title.trim();
    const estimated = Number(form.estimated_hours);

    if (!title) {
      setFormError('Judul tugas wajib diisi.');
      return;
    }
    if (!form.department_id) {
      setFormError('Departemen wajib dipilih.');
      return;
    }
    if (Number.isNaN(estimated) || estimated < 0.5 || estimated > 500) {
      setFormError('Estimasi waktu harus antara 0.5 hingga 500 jam.');
      return;
    }
    if (!form.due_date) {
      setFormError('Tenggat waktu wajib diisi.');
      return;
    }

    setSubmitting(true);

    const payload = {
      title,
      department_id: Number(form.department_id),
      estimated_hours: estimated,
      priority: form.priority,
      due_date: form.due_date,
      status: form.status,
      description: form.description.trim() || null,
    };

    try {
      if (editingTask) {
        const res = await taskService.updateTask(editingTask.id, payload);
        toast.success(res.message || 'Data tugas berhasil diperbarui.');
      } else {
        const res = await taskService.createTask(payload);
        toast.success(res.message || 'Tugas baru berhasil ditambahkan.');
      }
      setFormSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan data tugas.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setDeleteLoading(true);

    try {
      const res = await taskService.deleteTask(deletingTask.id);
      toast.success(res.message || 'Tugas berhasil dihapus.');
      setDeletingTask(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Tugas tidak dapat dihapus.').message);
      setDeletingTask(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Tugas',
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex max-w-[240px] flex-col gap-0.5 whitespace-normal">
              <span className="line-clamp-1 text-xs font-medium text-foreground">
                {task.title}
              </span>
              <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                {task.description || 'Tidak ada deskripsi tambahan'}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.department?.name || '-',
        id: 'department',
        header: 'Departemen',
        cell: ({ row }) => {
          const dept = row.original.department;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                {dept?.code || '-'}
              </span>
              <span className="max-w-[130px] truncate text-xs text-muted-foreground">
                {dept?.name || '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.estimated_hours || 0),
        id: 'estimated_hours',
        header: 'Estimasi',
        cell: ({ row }) => (
          <span className="text-xs font-medium whitespace-nowrap text-foreground tabular-nums">
            {Number(row.original.estimated_hours || 0).toFixed(1)} jam
          </span>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Prioritas',
        cell: ({ row }) => {
          const meta = PRIORITY_META[row.original.priority] || PRIORITY_META.medium;
          return (
            <div className="whitespace-nowrap">
              <StatusBadge tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      },
      {
        accessorKey: 'due_date',
        header: 'Tenggat Waktu',
        cell: ({ row }) => {
          const task = row.original;
          const deadlineHint = getDeadlineIndicator(task.due_date, task.status);
          return (
            <div className="flex flex-col items-start gap-1 whitespace-nowrap">
              <span className="text-xs font-medium text-foreground tabular-nums">
                {task.due_date ? String(task.due_date).slice(0, 10) : '-'}
              </span>
              {deadlineHint && (
                <StatusBadge
                  tone={deadlineHint.tone}
                  label={deadlineHint.text}
                  showDot={false}
                />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const meta = TASK_STATUS_META[row.original.status] || TASK_STATUS_META.open;
          return (
            <div className="whitespace-nowrap">
              <StatusBadge tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.creator?.full_name || '-',
        id: 'creator',
        header: 'Pembuat',
        cell: ({ row }) => (
          <span className="block max-w-[130px] truncate text-xs text-muted-foreground">
            {row.original.creator?.full_name || '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="-mr-1.5 flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetailSheet(task);
                }}
                title="Lihat Detail Tugas"
                aria-label="Lihat Detail Tugas"
              >
                <Eye className="size-4" />
              </Button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditSheet(task);
                    }}
                    title="Ubah Tugas"
                    aria-label="Ubah Tugas"
                  >
                    <Edit3 className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeletingTask(task);
                    }}
                    title="Hapus Tugas"
                    aria-label="Hapus Tugas"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [openDetailSheet, openEditSheet, readOnly]
  );

  const selectedPriorityMeta = selectedTask
    ? PRIORITY_META[selectedTask.priority] || PRIORITY_META.medium
    : PRIORITY_META.medium;
  const selectedStatusMeta = selectedTask
    ? TASK_STATUS_META[selectedTask.status] || TASK_STATUS_META.open
    : TASK_STATUS_META.open;
  const selectedDeadlineHint = selectedTask
    ? getDeadlineIndicator(selectedTask.due_date, selectedTask.status)
    : null;
  const deadlinePressureCount = Number(summary.deadline_pressure_count || 0);

  return (
    <AppShell
      title={readOnly ? 'Tugas Tim' : 'Katalog Tugas'}
      breadcrumb={readOnly ? 'Ruang Kerja' : 'Operasional'}
      actions={
        !readOnly ? (
          <Button size="sm" onClick={openCreateSheet}>
            <Plus data-icon="inline-start" className="size-4" />
            Tambah Tugas
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-8">
        {/* 4 KPI Summary Cards */}
        {loading && !hasLoadedOnce ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Tugas Aktif"
              value={summary.active ?? 0}
              unit="tugas"
              icon={ClipboardList}
              hint={`Dari ${summary.total ?? 0} total tugas`}
            />

            <KpiStatCard
              label="Estimasi Jam Aktif"
              value={Number(summary.total_active_estimated_hours || 0).toFixed(1)}
              unit="jam"
              icon={Clock}
              hint="Beban kerja terencana"
            />

            <KpiStatCard
              label="Tekanan Tenggat"
              value={deadlinePressureCount}
              unit="tugas"
              icon={AlertTriangle}
              statusTone={deadlinePressureCount > 0 ? 'warning' : 'success'}
              statusLabel={deadlinePressureCount > 0 ? '≤ 7 hari / lewat' : 'Tenggat terkendali'}
            />

            <KpiStatCard
              label="Tugas Selesai"
              value={summary.completed ?? 0}
              unit="tugas"
              icon={CheckCircle2}
              status="completed"
              statusLabel="Selesai"
            />
          </section>
        )}

        {/* Tasks DataTable */}
        <DataTable
          title={readOnly ? 'Katalog Tugas Tim' : 'Rencana Tugas'}
          countLabel="tugas"
          columns={columns}
          data={tasks}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari judul tugas, deskripsi, atau departemen..."
          pageSize={10}
          onRowClick={(task) => openDetailSheet(task)}
          emptyTitle={hasActiveFilters ? 'Tidak ada tugas yang sesuai filter' : 'Belum ada data tugas'}
          emptyDescription={
            hasActiveFilters
              ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat katalog tugas.'
              : 'Tambahkan tugas pertama lengkap dengan estimasi waktu, prioritas, dan tenggat.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" className="size-4" />
                  Setel Ulang Filter
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" onClick={openCreateSheet}>
                  <Plus data-icon="inline-start" className="size-4" />
                  Tambah Tugas
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="status_filter"
                value={statusFilter || ALL_VALUE}
                onValueChange={(val) => setStatusFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="tasks-filter-status"
                  size="sm"
                  aria-label="Filter Status"
                  className="w-36 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="priority_filter"
                value={priorityFilter || ALL_VALUE}
                onValueChange={(val) => setPriorityFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="tasks-filter-priority"
                  size="sm"
                  aria-label="Filter Prioritas"
                  className="w-36 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Prioritas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Prioritas</SelectItem>
                    <SelectItem value="critical">Kritis</SelectItem>
                    <SelectItem value="high">Tinggi</SelectItem>
                    <SelectItem value="medium">Sedang</SelectItem>
                    <SelectItem value="low">Rendah</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="department_filter"
                value={departmentFilter || ALL_VALUE}
                onValueChange={(val) => setDepartmentFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="tasks-filter-department"
                  size="sm"
                  aria-label="Filter Departemen"
                  className="w-44 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.code ? `${dept.code} — ${dept.name}` : dept.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="due_filter"
                value={dueFilter || ALL_VALUE}
                onValueChange={(val) => setDueFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="tasks-filter-due"
                  size="sm"
                  aria-label="Filter Tenggat"
                  className="w-44 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Tenggat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Tenggat</SelectItem>
                    <SelectItem value="due_soon">Jatuh Tempo ≤ 7 Hari</SelectItem>
                    <SelectItem value="overdue">Melewati Tenggat</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="tasks-reset-filters"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      <RotateCcw data-icon="inline-start" className="size-4" />
                      Reset
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          }
        />
      </div>

      {/* Detail Slide-Over Sheet */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedTask)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Tugas"
        description={
          selectedTask
            ? `${selectedTask.department?.name || '-'} · Tenggat ${
                selectedTask.due_date ? String(selectedTask.due_date).slice(0, 10) : '-'
              }`
            : undefined
        }
        size="md"
        loading={detailLoading}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Tutup
            </Button>
            {!readOnly && selectedTask && (
              <Button
                type="button"
                onClick={() => {
                  const target = selectedTask;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Tugas
              </Button>
            )}
          </>
        }
      >
        {selectedTask && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={selectedPriorityMeta.tone}
                  label={`Prioritas ${selectedPriorityMeta.label}`}
                />
                <StatusBadge tone={selectedStatusMeta.tone} label={selectedStatusMeta.label} />
                {selectedDeadlineHint && (
                  <StatusBadge
                    tone={selectedDeadlineHint.tone}
                    label={selectedDeadlineHint.text}
                    showDot={false}
                  />
                )}
              </div>
              <h4 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {selectedTask.title}
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedTask.description || 'Tidak ada deskripsi tugas.'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Departemen</span>
                <span className="text-sm font-medium text-foreground">
                  {selectedTask.department?.name || '-'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Pembuat Tugas</span>
                <span className="text-sm font-medium text-foreground">
                  {selectedTask.creator?.full_name || '-'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Estimasi Waktu</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {Number(selectedTask.estimated_hours || 0).toFixed(1)} jam
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Tenggat Waktu</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {selectedTask.due_date ? String(selectedTask.due_date).slice(0, 10) : '-'}
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Penugasan Terkait</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedTask.assignments_count ?? selectedTask.assignments?.length ?? 0} penugasan
                </span>
              </div>

              {selectedTask.assignments && selectedTask.assignments.length > 0 ? (
                <div className="divide-y divide-border">
                  {selectedTask.assignments.map((assign) => {
                    const empName =
                      assign.employee?.full_name || `Pegawai #${assign.employee_id}`;
                    const assignMeta =
                      ASSIGNMENT_STATUS_META[assign.status] || ASSIGNMENT_STATUS_META.assigned;
                    return (
                      <div
                        key={assign.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-7 border border-border">
                            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                              {getInitials(empName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium text-foreground">
                            {empName}
                          </span>
                        </div>
                        <StatusBadge tone={assignMeta.tone} label={assignMeta.label} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada pegawai yang ditugaskan pada tugas ini.
                </p>
              )}
            </div>
          </div>
        )}
      </FormSheet>

      {/* Create / Edit Slide-Over Sheet */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={(open) => {
          if (!submitting) setFormSheetOpen(open);
        }}
        title={editingTask ? 'Ubah Data Tugas' : 'Tambah Tugas Baru'}
        description="Lengkapi ruang lingkup pekerjaan, estimasi jam, prioritas, dan tenggat waktu."
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
            <Button type="submit" form="task-form" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingTask
                  ? 'Simpan Perubahan'
                  : 'Simpan Tugas'}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="task-form-error"
                role="alert"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-xs">
              Judul Tugas <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              name="title"
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Contoh: Penyusunan Laporan Kepatuhan K3 Q4"
              className="rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-department" className="text-xs">
                Departemen <span className="text-destructive">*</span>
              </Label>
              <Select
                name="department_id"
                value={form.department_id || undefined}
                onValueChange={(val) => setForm((prev) => ({ ...prev, department_id: val }))}
              >
                <SelectTrigger id="task-department" className="w-full rounded-lg">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-estimated-hours" className="text-xs">
                Estimasi Waktu (Jam) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-estimated-hours"
                name="estimated_hours"
                type="number"
                required
                min="0.5"
                max="500"
                step="0.5"
                value={form.estimated_hours}
                onChange={(e) => setForm((prev) => ({ ...prev, estimated_hours: e.target.value }))}
                className="rounded-lg tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority" className="text-xs">
                Tingkat Prioritas <span className="text-destructive">*</span>
              </Label>
              <Select
                name="priority"
                value={form.priority}
                onValueChange={(val) => setForm((prev) => ({ ...prev, priority: val }))}
              >
                <SelectTrigger id="task-priority" className="w-full rounded-lg">
                  <SelectValue placeholder="Pilih Prioritas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="low">Rendah (Low)</SelectItem>
                    <SelectItem value="medium">Sedang (Medium)</SelectItem>
                    <SelectItem value="high">Tinggi (High)</SelectItem>
                    <SelectItem value="critical">Kritis (Critical)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due-date" className="text-xs">
                Tenggat Waktu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-due-date"
                name="due_date"
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                className="rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-status" className="text-xs">
              Status Tugas
            </Label>
            <Select
              name="status"
              value={form.status}
              onValueChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
            >
              <SelectTrigger id="task-status" className="w-full rounded-lg">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description" className="text-xs">
              Deskripsi Tugas (Opsional)
            </Label>
            <Textarea
              id="task-description"
              name="description"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Rincian ruang lingkup pekerjaan atau target keluaran..."
              className="rounded-lg"
            />
          </div>
        </form>
      </FormSheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingTask(null);
        }}
        title="Hapus Tugas?"
        description={
          deletingTask ? (
            <>
              Tugas <span className="font-medium text-foreground">{deletingTask.title}</span> akan
              dihapus dari perencanaan.
              {Number(deletingTask.assignments_count || 0) > 0 && (
                <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                  Perhatian: Tugas ini memiliki {deletingTask.assignments_count} penugasan terkait.
                  Penghapusan akan ditolak jika terdapat penugasan aktif atau catatan work log.
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel="Hapus Tugas"
        cancelLabel="Batal"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
