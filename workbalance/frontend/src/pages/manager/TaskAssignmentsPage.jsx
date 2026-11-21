import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  Eye,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { extractApiError } from '../../services/api';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { taskAssignmentService } from '../../services/taskAssignmentService';
import { taskService } from '../../services/taskService';

const STATUS_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const ASSIGNMENT_STATUS_STYLES = {
  assigned: { label: 'Assigned', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  completed: { label: 'Completed', badgeClass: 'bg-[#D1FAE5] text-[#047857]' },
};

const PRIORITY_STYLES = {
  critical: { label: 'Kritis', badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]' },
  high: { label: 'Tinggi', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  medium: { label: 'Sedang', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  low: { label: 'Rendah', badgeClass: 'bg-slate-100 text-slate-700' },
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || 'PG').slice(0, 2).toUpperCase();
}

function getDeadlineIndicator(deadlineStr, status) {
  if (!deadlineStr || status === 'completed') {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(deadlineStr).slice(0, 10)}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Lewat ${Math.abs(diffDays)} hari`,
      className: 'bg-[#FEE2E2] text-[#B91C1C]',
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Jatuh tempo hari ini',
      className: 'bg-[#FEF3C7] text-[#B45309]',
    };
  }

  if (diffDays <= 7) {
    return {
      text: `H-${diffDays}`,
      className: 'bg-[#FEF3C7] text-[#B45309]',
    };
  }

  return null;
}

function emptyAssignmentForm(tasks = [], employees = []) {
  const assignableTasks = tasks.filter((t) => t.status !== 'cancelled');
  const firstTask = assignableTasks[0] || tasks[0];
  const defaultDeadline = firstTask?.due_date
    ? String(firstTask.due_date).slice(0, 10)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    task_id: firstTask?.id ? String(firstTask.id) : '',
    employee_id: employees[0]?.id ? String(employees[0].id) : '',
    deadline: defaultDeadline,
    status: 'assigned',
  };
}

export default function TaskAssignmentsPage({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
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

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form, setForm] = useState(emptyAssignmentForm([], []));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingAssignment, setDeletingAssignment] = useState(null);
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
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data penugasan pekerjaan.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, employeeFilter, departmentFilter, deadlineFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || employeeFilter || departmentFilter || deadlineFilter),
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
    return tasks.filter(
      (task) => task.status !== 'cancelled' || (editingAssignment && editingAssignment.task_id === task.id)
    );
  }, [tasks, editingAssignment]);

  // --- Detail Handler ---
  const openDetailModal = async (assignment) => {
    setSelectedAssignment(assignment);
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const detail = await taskAssignmentService.getTaskAssignment(assignment.id);
      setSelectedAssignment(detail);
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal memuat detail penugasan.').message);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create / Edit Handlers ---
  const openCreateModal = () => {
    setEditingAssignment(null);
    setForm(emptyAssignmentForm(tasks, employees));
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setForm({
      task_id: String(assignment.task_id || ''),
      employee_id: String(assignment.employee_id || ''),
      deadline: assignment.deadline ? String(assignment.deadline).slice(0, 10) : '',
      status: assignment.status || 'assigned',
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleTaskSelectChange = (taskIdValue) => {
    const matchedTask = tasks.find((t) => String(t.id) === String(taskIdValue));
    setForm((prev) => ({
      ...prev,
      task_id: taskIdValue,
      deadline:
        !editingAssignment && matchedTask?.due_date
          ? String(matchedTask.due_date).slice(0, 10)
          : prev.deadline,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      task_id: Number(form.task_id),
      employee_id: Number(form.employee_id),
      deadline: form.deadline,
      status: form.status,
    };

    try {
      if (editingAssignment) {
        const res = await taskAssignmentService.updateTaskAssignment(editingAssignment.id, payload);
        showToast('success', res.message || 'Data penugasan berhasil diperbarui.');
      } else {
        const res = await taskAssignmentService.createTaskAssignment(payload);
        showToast('success', res.message || 'Penugasan pegawai berhasil ditambahkan.');
      }
      setFormModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan penugasan pegawai.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingAssignment) return;
    setDeleteLoading(true);

    try {
      const res = await taskAssignmentService.deleteTaskAssignment(deletingAssignment.id);
      showToast('success', res.message || 'Data penugasan berhasil dihapus.');
      setDeletingAssignment(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Penugasan tidak dapat dihapus.').message);
      setDeletingAssignment(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const kpiCards = [
    {
      label: 'Penugasan Aktif',
      value: summary.active,
      badge: `Dari ${summary.total} total penugasan`,
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: ClipboardCheck,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Total Jam Ditugaskan',
      value: `${Number(summary.total_active_assigned_hours || 0).toFixed(1)} jam`,
      badge:
        !readOnly && Number(summary.overloaded_employees_count) > 0
          ? `${summary.overloaded_employees_count} pegawai > 40 jam`
          : 'Beban penugasan aktif',
      badgeClass:
        !readOnly && Number(summary.overloaded_employees_count) > 0
          ? 'bg-[#FEF3C7] text-[#B45309]'
          : 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Clock,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Tekanan Tenggat',
      value: summary.deadline_pressure_count,
      badge: 'Jatuh tempo ≤ 7 hari / lewat',
      badgeClass:
        Number(summary.deadline_pressure_count) > 0
          ? 'bg-[#FEF3C7] text-[#B45309]'
          : 'bg-[#D1FAE5] text-[#047857]',
      icon: AlertTriangle,
      iconBg:
        Number(summary.deadline_pressure_count) > 0
          ? 'bg-[#FEF3C7] text-[#F59E0B]'
          : 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Penugasan Selesai',
      value: summary.completed,
      badge: 'Status completed',
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: CheckCircle2,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
  ];

  return (
    <AppShell
      title={readOnly ? 'Penugasan Saya' : 'Manajemen Penugasan Kerja'}
      breadcrumb={
        readOnly
          ? 'Pegawai / Daftar Penugasan & Tenggat Pribadi'
          : 'Operasional / Distribusi Penugasan / PBI-04'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari judul tugas, nama pegawai, atau kode..."
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

        {/* Read-only notice for Employee */}
        {readOnly && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs font-medium text-[#0369A1]">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Mode Baca Saja: Menampilkan daftar pekerjaan yang ditugaskan khusus kepada Anda beserta tenggat waktunya.
            </span>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Data Penugasan</h2>
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

        {/* Assignments Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">Daftar Penugasan Kerja</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {assignments.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari tugas atau pegawai..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Status Filter Pills */}
                <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
                  {STATUS_PILLS.map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setStatusFilter(pill.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        statusFilter === pill.value
                          ? 'bg-white text-[#1E293B] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {!readOnly && (
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    aria-label="Filter Pegawai"
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                  >
                    <option value="">Semua Pegawai</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  aria-label="Filter Departemen"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                <select
                  value={deadlineFilter}
                  onChange={(e) => setDeadlineFilter(e.target.value)}
                  aria-label="Filter Tenggat"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Semua Tenggat</option>
                  <option value="due_soon">Tenggat ≤ 7 Hari</option>
                  <option value="overdue">Melewati Tenggat</option>
                </select>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Penugasan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters
                    ? 'Tidak ada penugasan yang sesuai filter'
                    : 'Belum ada penugasan pekerjaan'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat distribusi penugasan.'
                    : readOnly
                      ? 'Belum ada tugas yang ditetapkan kepada Anda pada periode ini.'
                      : 'Tetapkan tugas kepada pegawai lengkap dengan tenggat waktu untuk memulai distribusi beban kerja.'}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Setel Ulang Filter
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Penugasan</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Success State Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[#64748B] text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Pegawai Penerima</th>
                      <th className="py-3 px-4 font-semibold">Tugas & Prioritas</th>
                      <th className="py-3 px-4 font-semibold">Estimasi Beban</th>
                      <th className="py-3 px-4 font-semibold">Tenggat Penugasan</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Ditugaskan Oleh</th>
                      <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {assignments.map((item) => {
                      const statusMeta =
                        ASSIGNMENT_STATUS_STYLES[item.status] || ASSIGNMENT_STATUS_STYLES.assigned;
                      const priorityMeta =
                        PRIORITY_STYLES[item.task?.priority] || PRIORITY_STYLES.medium;
                      const deadlineHint = getDeadlineIndicator(item.deadline, item.status);

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#E0F2FE] text-[#0369A1] text-xs font-bold flex items-center justify-center shrink-0">
                                {getInitials(item.employee?.full_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[#1E293B] truncate">
                                  {item.employee?.full_name || '-'}
                                </p>
                                <p className="text-xs text-slate-500 truncate tabular-nums">
                                  {item.employee?.employee_code || '-'} •{' '}
                                  {item.employee?.position?.title || '-'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-semibold text-[#1E293B] truncate">
                              {item.task?.title || '-'}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityMeta.badgeClass}`}
                              >
                                {priorityMeta.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                {item.task?.department?.code || '-'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 tabular-nums font-semibold text-[#1E293B] whitespace-nowrap">
                            {Number(item.task?.estimated_hours || 0).toFixed(1)} jam
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <span className="tabular-nums text-slate-700 font-medium">
                                {item.deadline ? String(item.deadline).slice(0, 10) : '-'}
                              </span>
                              {deadlineHint && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${deadlineHint.className}`}
                                >
                                  {deadlineHint.text}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="text-xs font-medium text-[#1E293B]">
                              {item.assigner?.full_name || '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              {item.assigned_at ? String(item.assigned_at).slice(0, 10) : '-'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Lihat Detail Penugasan"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                    title="Ubah Penugasan"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingAssignment(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70 transition cursor-pointer"
                                    title="Hapus Penugasan"
                                  >
                                    <Trash2 className="w-4 h-4" />
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

      {/* Modal Detail Penugasan */}
      {detailModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">Detail Penugasan Pekerjaan</h3>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {detailLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-slate-100 rounded w-3/4" />
                  <div className="h-16 bg-slate-100 rounded" />
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (
                            ASSIGNMENT_STATUS_STYLES[selectedAssignment.status] ||
                            ASSIGNMENT_STATUS_STYLES.assigned
                          ).badgeClass
                        }`}
                      >
                        {
                          (
                            ASSIGNMENT_STATUS_STYLES[selectedAssignment.status] ||
                            ASSIGNMENT_STATUS_STYLES.assigned
                          ).label
                        }
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (
                            PRIORITY_STYLES[selectedAssignment.task?.priority] ||
                            PRIORITY_STYLES.medium
                          ).badgeClass
                        }`}
                      >
                        Prioritas{' '}
                        {
                          (
                            PRIORITY_STYLES[selectedAssignment.task?.priority] ||
                            PRIORITY_STYLES.medium
                          ).label
                        }
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-[#1E293B]">
                      {selectedAssignment.task?.title || '-'}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {selectedAssignment.task?.description || 'Tidak ada deskripsi tambahan.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Pegawai Penerima</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedAssignment.employee?.full_name || '-'}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {selectedAssignment.employee?.employee_code || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Departemen</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedAssignment.task?.department?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Estimasi Beban</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {Number(selectedAssignment.task?.estimated_hours || 0).toFixed(1)} jam
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tenggat Penugasan</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedAssignment.deadline
                          ? String(selectedAssignment.deadline).slice(0, 10)
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ditugaskan Oleh</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedAssignment.assigner?.full_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tanggal Penugasan</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {selectedAssignment.assigned_at
                          ? String(selectedAssignment.assigned_at).slice(0, 10)
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Riwayat Work Log ({selectedAssignment.work_logs_count ?? 0})
                    </p>
                    <p className="text-xs text-slate-500">
                      {Number(selectedAssignment.work_logs_count || 0) > 0
                        ? `Terdapat ${selectedAssignment.work_logs_count} catatan jam kerja aktual pada penugasan ini.`
                        : 'Belum ada work log yang dicatat untuk penugasan ini.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Ubah Penugasan */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingAssignment ? 'Ubah Penugasan Pegawai' : 'Tambah Penugasan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tugas yang Ditugaskan
                </label>
                <select
                  required
                  value={form.task_id}
                  onChange={(e) => handleTaskSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                >
                  <option value="">Pilih Tugas</option>
                  {taskOptions.map((task) => (
                    <option key={task.id} value={task.id}>
                      [{task.department?.code || '-'}] {task.title} ({Number(task.estimated_hours).toFixed(1)}j)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pegawai Penerima
                </label>
                <select
                  required
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                >
                  <option value="">Pilih Pegawai Aktif</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code}) — {emp.department?.name || '-'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tenggat Penugasan
                  </label>
                  <input
                    type="date"
                    required
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Penugasan
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition cursor-pointer"
                >
                  {submitting
                    ? 'Menyimpan...'
                    : editingAssignment
                      ? 'Simpan Perubahan'
                      : 'Simpan Penugasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Penugasan */}
      {deletingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Penugasan?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Penugasan <span className="font-semibold text-[#1E293B]">{deletingAssignment.task?.title}</span> untuk{' '}
              <span className="font-semibold text-[#1E293B]">{deletingAssignment.employee?.full_name}</span> akan dihapus.
              {(deletingAssignment.status === 'completed' || Number(deletingAssignment.work_logs_count || 0) > 0) && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Penugasan yang sudah selesai atau memiliki riwayat work log akan ditolak oleh sistem untuk menjaga integritas data.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingAssignment(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#EF4444] hover:bg-red-600 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {deleteLoading ? 'Menghapus...' : 'Hapus Penugasan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
