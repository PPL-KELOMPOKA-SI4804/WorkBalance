import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { daysUntilDate, formatDate, toApiDate, toISODateLocal } from '@/lib/format';
import { getInitials } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import { taskAssignmentService } from '@/services/taskAssignmentService';
import { taskService } from '@/services/taskService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import {
  ConfirmDialog,
  DataTable,
  DatePicker,
  FormSheet,
  KpiStatCard,
  RowActionsMenu,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const ASSIGNMENT_STATUS_META = {
  assigned: { label: 'Assigned', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
};

const PRIORITY_META = {
  critical: { label: 'Kritis', tone: 'danger' },
  high: { label: 'Tinggi', tone: 'warning' },
  medium: { label: 'Sedang', tone: 'info' },
  low: { label: 'Rendah', tone: 'neutral' },
};

function getDeadlineIndicator(deadlineStr, status) {
  if (!deadlineStr || status === 'completed') {
    return null;
  }

  const diffDays = daysUntilDate(deadlineStr);
  if (diffDays === null) return null;

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

function emptyAssignmentForm(tasks = [], employees = []) {
  const assignableTasks = tasks.filter((t) => t.status !== 'cancelled');
  const firstTask = assignableTasks[0] || tasks[0];
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + 7);
  const defaultDeadline = firstTask?.due_date
    ? toApiDate(firstTask.due_date)
    : toISODateLocal(fallbackDate);

  return {
    task_id: firstTask?.id ? String(firstTask.id) : '',
    employee_id: employees[0]?.id ? String(employees[0].id) : '',
    deadline: defaultDeadline,
    status: 'assigned',
  };
}

export default function TaskAssignmentsPage({ readOnly = false }) {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isEmployee = user?.role === 'employee';

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    completed: 0,
    total_active_assigned_hours: 0,
    deadline_pressure_count: 0,
    overloaded_employees_count: 0,
  });

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');

  // Detail Sheet State
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Create / Edit Sheet State
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form, setForm] = useState(() => emptyAssignmentForm([], []));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete ConfirmDialog State
  const [deletingAssignment, setDeletingAssignment] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [assignRes, tasksRes, empRes, deptRes] = await Promise.all([
        taskAssignmentService.getTaskAssignments({
          search: search.trim(),
          status: statusFilter,
          employee_id: !readOnly ? employeeFilter : '',
          department_id: departmentFilter,
          deadline_filter: deadlineFilter,
        }),
        !readOnly ? taskService.getTasks() : Promise.resolve(null),
        !readOnly ? employeeService.getEmployees({ status: 'active' }) : Promise.resolve(null),
        !readOnly ? departmentService.getDepartments() : Promise.resolve(null),
      ]);

      const assignmentList = assignRes?.assignments || [];
      setAssignments(assignmentList);
      setSummary(
        assignRes?.summary || {
          total: 0,
          active: 0,
          completed: 0,
          total_active_assigned_hours: 0,
          deadline_pressure_count: 0,
          overloaded_employees_count: 0,
        }
      );

      if (!readOnly) {
        setTasks(tasksRes?.tasks || []);
        setEmployees(empRes?.employees || []);
        setDepartments(deptRes || []);
      } else {
        setDepartments((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          assignmentList.forEach((item) => {
            if (item.task?.department) {
              map.set(item.task.department.id, item.task.department);
            }
            if (item.employee?.department) {
              map.set(item.employee.department.id, item.employee.department);
            }
          });
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      }
      setHasLoadedOnce(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data penugasan pekerjaan.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, employeeFilter, departmentFilter, deadlineFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useRefetchOnFocus(loadAllData);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        search.trim() || statusFilter || employeeFilter || departmentFilter || deadlineFilter
      ),
    [search, statusFilter, employeeFilter, departmentFilter, deadlineFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setEmployeeFilter('');
    setDepartmentFilter('');
    setDeadlineFilter('');
  };

  const taskOptions = useMemo(() => {
    const filtered = tasks.filter(
      (task) =>
        task.status !== 'cancelled' || (editingAssignment && editingAssignment.task_id === task.id)
    );
    if (
      editingAssignment?.task &&
      !filtered.some((t) => String(t.id) === String(editingAssignment.task_id))
    ) {
      return [editingAssignment.task, ...filtered];
    }
    return filtered;
  }, [tasks, editingAssignment]);

  const employeeOptions = useMemo(() => {
    if (
      editingAssignment?.employee &&
      !employees.some((emp) => String(emp.id) === String(editingAssignment.employee_id))
    ) {
      return [editingAssignment.employee, ...employees];
    }
    return employees;
  }, [employees, editingAssignment]);

  // Detail Handler
  const openDetailSheet = useCallback(async (assignment) => {
    setSelectedAssignment(assignment);
    setDetailSheetOpen(true);
    setDetailLoading(true);

    try {
      const detail = await taskAssignmentService.getTaskAssignment(assignment.id);
      setSelectedAssignment(detail);
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal memuat detail penugasan.').message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Create / Edit Handlers
  const openCreateSheet = useCallback(() => {
    setEditingAssignment(null);
    setForm(emptyAssignmentForm(tasks, employees));
    setFormError('');
    setFormSheetOpen(true);
  }, [tasks, employees]);

  const openEditSheet = useCallback((assignment) => {
    setEditingAssignment(assignment);
    setForm({
      task_id: assignment.task_id ? String(assignment.task_id) : '',
      employee_id: assignment.employee_id ? String(assignment.employee_id) : '',
      deadline: toApiDate(assignment.deadline),
      status: assignment.status || 'assigned',
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleTaskSelectChange = (taskIdValue) => {
    const matchedTask = tasks.find((t) => String(t.id) === String(taskIdValue));
    setForm((prev) => ({
      ...prev,
      task_id: taskIdValue,
      deadline:
        !editingAssignment && matchedTask?.due_date
          ? toApiDate(matchedTask.due_date)
          : prev.deadline,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const deadlineApi = toApiDate(form.deadline);

    if (!form.task_id) {
      setFormError('Tugas yang ditugaskan wajib dipilih.');
      return;
    }
    if (!form.employee_id) {
      setFormError('Pegawai penerima wajib dipilih.');
      return;
    }
    if (!deadlineApi) {
      setFormError('Tenggat penugasan wajib diisi.');
      return;
    }

    setSubmitting(true);

    const payload = {
      task_id: Number(form.task_id),
      employee_id: Number(form.employee_id),
      deadline: deadlineApi,
      status: form.status,
    };

    try {
      if (editingAssignment) {
        const res = await taskAssignmentService.updateTaskAssignment(editingAssignment.id, payload);
        toast.success(res.message || 'Data penugasan berhasil diperbarui.');
      } else {
        const res = await taskAssignmentService.createTaskAssignment(payload);
        toast.success(res.message || 'Penugasan pegawai berhasil ditambahkan.');
      }
      setFormSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan penugasan pegawai.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingAssignment) return;
    setDeleteLoading(true);

    try {
      const res = await taskAssignmentService.deleteTaskAssignment(deletingAssignment.id);
      toast.success(res.message || 'Data penugasan berhasil dihapus.');
      setDeletingAssignment(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Penugasan tidak dapat dihapus.').message);
      setDeletingAssignment(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [];

    if (!isEmployee) {
      cols.push({
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original.employee || {};
          const fullName = emp.full_name || '-';
          return (
            <div className="flex min-w-0 max-w-[190px] items-center gap-2.5">
              <Avatar className="size-7 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs font-medium text-foreground" title={fullName}>
                {fullName}
              </span>
            </div>
          );
        },
      });
    }

    cols.push({
      accessorFn: (row) => row.task?.title || '-',
      id: 'task',
      header: 'Tugas',
      cell: ({ row }) => {
        const title = row.original.task?.title || '-';
        return (
          <span
            className="block max-w-[260px] truncate text-xs font-medium text-foreground"
            title={title}
          >
            {title}
          </span>
        );
      },
    });

    if (isEmployee) {
      cols.push({
        accessorFn: (row) => row.task?.priority || 'medium',
        id: 'priority',
        header: 'Prioritas',
        meta: { className: 'hidden sm:table-cell' },
        cell: ({ row }) => {
          const meta = PRIORITY_META[row.original.task?.priority] || PRIORITY_META.medium;
          return (
            <div className="whitespace-nowrap">
              <StatusBadge tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      });
    }

    cols.push(
      {
        accessorKey: 'deadline',
        header: 'Tenggat',
        cell: ({ row }) => {
          const item = row.original;
          const deadlineHint = getDeadlineIndicator(item.deadline, item.status);
          return (
            <span
              title={deadlineHint?.text}
              className={cn(
                'text-xs font-medium whitespace-nowrap tabular-nums',
                deadlineHint?.tone === 'danger' ? 'text-destructive' : 'text-foreground'
              )}
            >
              {formatDate(item.deadline)}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const meta =
            ASSIGNMENT_STATUS_META[row.original.status] || ASSIGNMENT_STATUS_META.assigned;
          return (
            <div className="whitespace-nowrap">
              <StatusBadge tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      }
    );

    if (!readOnly) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <RowActionsMenu
              ariaLabel="Menu aksi penugasan"
              items={[
                {
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditSheet(item),
                },
                {
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  onSelect: () => setDeletingAssignment(item),
                },
              ]}
            />
          );
        },
      });
    }

    return cols;
  }, [isEmployee, openEditSheet, readOnly]);

  const selectedStatusMeta = selectedAssignment
    ? ASSIGNMENT_STATUS_META[selectedAssignment.status] || ASSIGNMENT_STATUS_META.assigned
    : ASSIGNMENT_STATUS_META.assigned;
  const selectedPriorityMeta = selectedAssignment
    ? PRIORITY_META[selectedAssignment.task?.priority] || PRIORITY_META.medium
    : PRIORITY_META.medium;
  const selectedDeadlineHint = selectedAssignment
    ? getDeadlineIndicator(selectedAssignment.deadline, selectedAssignment.status)
    : null;
  const overloadedCount = Number(summary.overloaded_employees_count || 0);
  const deadlinePressureCount = Number(summary.deadline_pressure_count || 0);

  return (
    <AppShell
      title={readOnly ? 'Penugasan Saya' : 'Penugasan Kerja'}
      breadcrumb={readOnly ? 'Ruang Kerja' : 'Operasional'}
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
              label="Penugasan Aktif"
              value={summary.active ?? 0}
              unit="tugas"
              icon={ClipboardCheck}
              hint={`Dari ${summary.total ?? 0} total penugasan`}
            />

            <KpiStatCard
              label="Jam Ditugaskan"
              value={Number(summary.total_active_assigned_hours || 0).toFixed(1)}
              unit="jam"
              icon={Clock}
              statusTone={!readOnly && overloadedCount > 0 ? 'warning' : undefined}
              statusLabel={
                !readOnly && overloadedCount > 0
                  ? `${overloadedCount} pegawai > 40 jam`
                  : undefined
              }
              hint={!readOnly && overloadedCount > 0 ? undefined : 'Beban penugasan aktif'}
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
              label="Penugasan Selesai"
              value={summary.completed ?? 0}
              unit="tugas"
              icon={CheckCircle2}
              status="completed"
              statusLabel="Selesai"
            />
          </section>
        )}

        {/* Task Assignments DataTable */}
        <DataTable
          title="Penugasan"
          countLabel="penugasan"
          columns={columns}
          data={assignments}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari judul tugas, nama pegawai, atau kode..."
          pageSize={10}
          onRowClick={(item) => openDetailSheet(item)}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada penugasan yang sesuai filter'
              : 'Belum ada penugasan pekerjaan'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat distribusi penugasan.'
              : readOnly
                ? 'Belum ada tugas yang ditetapkan kepada Anda pada periode ini.'
                : 'Tetapkan tugas kepada pegawai lengkap dengan tenggat waktu untuk memulai distribusi beban kerja.'
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
                <Button size="sm" className="rounded-lg" onClick={openCreateSheet}>
                  <Plus data-icon="inline-start" className="size-4" />
                  Tambah Penugasan
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
                  id="assignments-filter-status"
                  size="sm"
                  aria-label="Filter Status"
                  className="w-36 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {!readOnly && (
                <Select
                  name="employee_filter"
                  value={employeeFilter || ALL_VALUE}
                  onValueChange={(val) => setEmployeeFilter(val === ALL_VALUE ? '' : val)}
                >
                  <SelectTrigger
                    id="assignments-filter-employee"
                    size="sm"
                    aria-label="Filter Pegawai"
                    className="w-48 rounded-lg bg-background text-xs"
                  >
                    <SelectValue placeholder="Semua Pegawai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={ALL_VALUE}>Semua Pegawai</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {emp.employee_code}
                            </span>
                            <span>{emp.full_name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}

              <Select
                name="department_filter"
                value={departmentFilter || ALL_VALUE}
                onValueChange={(val) => setDepartmentFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="assignments-filter-department"
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
                        {dept.code ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {dept.code}
                            </span>
                            <span>{dept.name}</span>
                          </span>
                        ) : (
                          dept.name
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="deadline_filter"
                value={deadlineFilter || ALL_VALUE}
                onValueChange={(val) => setDeadlineFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="assignments-filter-deadline"
                  size="sm"
                  aria-label="Filter Tenggat"
                  className="w-44 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Tenggat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Tenggat</SelectItem>
                    <SelectItem value="due_soon">Tenggat ≤ 7 Hari</SelectItem>
                    <SelectItem value="overdue">Melewati Tenggat</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="assignments-reset-filters"
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
            !readOnly ? (
              <Button size="sm" className="rounded-lg" onClick={openCreateSheet}>
                <Plus data-icon="inline-start" className="size-4" />
                Tambah Penugasan
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Detail Slide-Over Sheet */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedAssignment)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Penugasan"
        description={
          selectedAssignment
            ? `${selectedAssignment.employee?.full_name || '-'} · Tenggat ${formatDate(selectedAssignment.deadline)}`
            : undefined
        }
        size="md"
        loading={detailLoading}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Tutup
            </Button>
            {!readOnly && selectedAssignment && (
              <Button
                type="button"
                onClick={() => {
                  const target = selectedAssignment;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Penugasan
              </Button>
            )}
          </>
        }
      >
        {selectedAssignment && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={selectedStatusMeta.tone} label={selectedStatusMeta.label} />
                <StatusBadge
                  tone={selectedPriorityMeta.tone}
                  label={`Prioritas ${selectedPriorityMeta.label}`}
                />
                {selectedDeadlineHint && (
                  <StatusBadge
                    tone={selectedDeadlineHint.tone}
                    label={selectedDeadlineHint.text}
                    showDot={false}
                  />
                )}
              </div>
              <h4 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {selectedAssignment.task?.title || '-'}
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedAssignment.task?.description || 'Tidak ada deskripsi tambahan.'}
              </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                    {getInitials(selectedAssignment.employee?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">Pegawai Penerima</span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {selectedAssignment.employee?.full_name || '-'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">
                      {selectedAssignment.employee?.employee_code || '-'}
                    </span>
                    {selectedAssignment.employee?.department?.name
                      ? ` · ${selectedAssignment.employee.department.name}`
                      : ''}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Departemen</span>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    {selectedAssignment.task?.department?.code && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {selectedAssignment.task.department.code}
                      </span>
                    )}
                    <span>{selectedAssignment.task?.department?.name || '-'}</span>
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Estimasi Beban</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {Number(selectedAssignment.task?.estimated_hours || 0).toFixed(1)} jam
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Tenggat Penugasan</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    {formatDate(selectedAssignment.deadline)}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Ditugaskan Oleh</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedAssignment.assigner?.full_name || '-'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Tanggal Penugasan</span>
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatDate(selectedAssignment.assigned_at)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Riwayat Work Log</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedAssignment.work_logs_count ?? 0} catatan
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {Number(selectedAssignment.work_logs_count || 0) > 0
                  ? `Terdapat ${selectedAssignment.work_logs_count} catatan jam kerja aktual pada penugasan ini.`
                  : 'Belum ada work log yang dicatat untuk penugasan ini.'}
              </p>
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
        title={editingAssignment ? 'Ubah Penugasan Pegawai' : 'Tambah Penugasan Baru'}
        description="Distribusikan tugas kepada pegawai aktif beserta tenggat dan status pelaksanaan."
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
            <Button type="submit" form="assignment-form" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingAssignment
                  ? 'Simpan Perubahan'
                  : 'Simpan Penugasan'}
            </Button>
          </>
        }
      >
        <form id="assignment-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="assignment-form-error"
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
            <Label htmlFor="assignment-task" className="text-xs">
              Tugas yang Ditugaskan <span className="text-destructive">*</span>
            </Label>
            <Select
              name="task_id"
              value={form.task_id || undefined}
              onValueChange={handleTaskSelectChange}
            >
              <SelectTrigger id="assignment-task" className="w-full rounded-lg">
                <SelectValue placeholder="Pilih Tugas" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      <span className="inline-flex items-center gap-2">
                        {task.department?.code && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {task.department.code}
                          </span>
                        )}
                        <span>
                          {task.title} ({Number(task.estimated_hours || 0).toFixed(1)}j)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-employee" className="text-xs">
              Pegawai Penerima <span className="text-destructive">*</span>
            </Label>
            <Select
              name="employee_id"
              value={form.employee_id || undefined}
              onValueChange={(val) => setForm((prev) => ({ ...prev, employee_id: val }))}
            >
              <SelectTrigger id="assignment-employee" className="w-full rounded-lg">
                <SelectValue placeholder="Pilih Pegawai Aktif" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {employeeOptions.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {emp.employee_code}
                        </span>
                        <span>
                          {emp.full_name}
                          {emp.department?.name ? ` · ${emp.department.name}` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignment-deadline" className="text-xs">
                Tenggat Penugasan <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                id="assignment-deadline"
                value={form.deadline}
                onChange={(val) => setForm((prev) => ({ ...prev, deadline: val }))}
                placeholder="DD-MM-YYYY"
                ariaLabel="Tenggat Penugasan"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignment-status" className="text-xs">
                Status Penugasan
              </Label>
              <Select
                name="status"
                value={form.status}
                onValueChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
              >
                <SelectTrigger id="assignment-status" className="w-full rounded-lg">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
      </FormSheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingAssignment)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingAssignment(null);
        }}
        title="Hapus Penugasan?"
        description={
          deletingAssignment ? (
            <>
              Penugasan{' '}
              <span className="font-medium text-foreground">{deletingAssignment.task?.title}</span>{' '}
              untuk{' '}
              <span className="font-medium text-foreground">
                {deletingAssignment.employee?.full_name}
              </span>{' '}
              akan dihapus.
              {(deletingAssignment.status === 'completed' ||
                Number(deletingAssignment.work_logs_count || 0) > 0) && (
                <span className="mt-2 block rounded-xl border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
                  Perhatian: Penugasan yang sudah selesai atau memiliki riwayat work log akan
                  ditolak oleh sistem untuk menjaga integritas data.
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel="Hapus Penugasan"
        cancelLabel="Batal"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
