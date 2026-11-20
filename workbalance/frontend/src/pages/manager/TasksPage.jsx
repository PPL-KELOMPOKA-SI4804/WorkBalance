import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
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
import { taskService } from '../../services/taskService';

const STATUS_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_STYLES = {
  critical: { label: 'Kritis', badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]' },
  high: { label: 'Tinggi', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  medium: { label: 'Sedang', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  low: { label: 'Rendah', badgeClass: 'bg-slate-100 text-slate-700' },
};

const STATUS_STYLES = {
  open: { label: 'Open', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  completed: { label: 'Completed', badgeClass: 'bg-[#D1FAE5] text-[#047857]' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]' },
};

function getDeadlineIndicator(dueDateStr, status) {
  if (!dueDateStr || status === 'completed' || status === 'cancelled') {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(dueDateStr).slice(0, 10)}T00:00:00`);
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
  const [loading, setLoading] = useState(true);
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

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(emptyTaskForm([]));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingTask, setDeletingTask] = useState(null);
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
    () => Boolean(search.trim() || statusFilter || priorityFilter || departmentFilter || dueFilter),
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
  const openDetailModal = async (task) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const detail = await taskService.getTask(task.id);
      setSelectedTask(detail);
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal memuat detail tugas.').message);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create / Edit Handlers ---
  const openCreateModal = () => {
    setEditingTask(null);
    setForm(emptyTaskForm(departments));
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title || '',
      department_id: String(task.department_id || ''),
      estimated_hours: String(Number(task.estimated_hours || 1)),
      priority: task.priority || 'medium',
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : '',
      status: task.status || 'open',
      description: task.description || '',
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      title: form.title.trim(),
      department_id: Number(form.department_id),
      estimated_hours: Number(form.estimated_hours),
      priority: form.priority,
      due_date: form.due_date,
      status: form.status,
      description: form.description.trim() || null,
    };

    try {
      if (editingTask) {
        const res = await taskService.updateTask(editingTask.id, payload);
        showToast('success', res.message || 'Data tugas berhasil diperbarui.');
      } else {
        const res = await taskService.createTask(payload);
        showToast('success', res.message || 'Tugas baru berhasil ditambahkan.');
      }
      setFormModalOpen(false);
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
      showToast('success', res.message || 'Tugas berhasil dihapus.');
      setDeletingTask(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Tugas tidak dapat dihapus.').message);
      setDeletingTask(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const kpiCards = [
    {
      label: 'Tugas Aktif',
      value: summary.active,
      badge: `Dari ${summary.total} total tugas`,
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: ClipboardList,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Estimasi Jam Aktif',
      value: `${Number(summary.total_active_estimated_hours || 0).toFixed(1)} jam`,
      badge: 'Beban kerja terencana',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
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
      label: 'Tugas Selesai',
      value: summary.completed,
      badge: 'Status completed',
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: CheckCircle2,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
  ];

  return (
    <AppShell
      title={readOnly ? 'Daftar Tugas Tim' : 'Manajemen Tugas'}
      breadcrumb={
        readOnly
          ? 'Pegawai / Daftar Tugas & Tenggat (Read-Only)'
          : 'Operasional / Perencanaan Tugas / PBI-03'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari judul tugas, deskripsi, atau departemen..."
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
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs text-[#0369A1]">
            <div className="flex items-center gap-2 font-medium">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Mode Baca Saja: Anda dapat meninjau rencana tugas, estimasi jam, dan tenggat waktu.</span>
            </div>
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
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Data Tugas</h2>
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

        {/* Data Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">Daftar Tugas</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {tasks.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari judul tugas..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Status Pills */}
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

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Filter Prioritas"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Semua Prioritas</option>
                  <option value="critical">Kritis</option>
                  <option value="high">Tinggi</option>
                  <option value="medium">Sedang</option>
                  <option value="low">Rendah</option>
                </select>

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
                  value={dueFilter}
                  onChange={(e) => setDueFilter(e.target.value)}
                  aria-label="Filter Tenggat"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Semua Tenggat</option>
                  <option value="due_soon">Jatuh Tempo ≤ 7 Hari</option>
                  <option value="overdue">Melewati Tenggat</option>
                </select>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Tugas</span>
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
            ) : tasks.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters ? 'Tidak ada tugas yang sesuai filter' : 'Belum ada data tugas'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat daftar tugas.'
                    : 'Tambahkan tugas pertama lengkap dengan estimasi waktu, prioritas, dan tenggat.'}
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
                      <span>Tambah Tugas</span>
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
                      <th className="py-3 px-4 font-semibold">Tugas</th>
                      <th className="py-3 px-4 font-semibold">Departemen</th>
                      <th className="py-3 px-4 font-semibold">Estimasi</th>
                      <th className="py-3 px-4 font-semibold">Prioritas</th>
                      <th className="py-3 px-4 font-semibold">Tenggat Waktu</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Pembuat</th>
                      <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {tasks.map((task) => {
                      const priorityMeta = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                      const statusMeta = STATUS_STYLES[task.status] || STATUS_STYLES.open;
                      const deadlineHint = getDeadlineIndicator(task.due_date, task.status);

                      return (
                        <tr
                          key={task.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-semibold text-[#1E293B] truncate">{task.title}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {task.description || 'Tidak ada deskripsi tambahan'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold mr-1.5">
                              {task.department?.code || '-'}
                            </span>
                            <span className="text-xs text-slate-600">
                              {task.department?.name || '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 tabular-nums font-semibold text-[#1E293B] whitespace-nowrap">
                            {Number(task.estimated_hours).toFixed(1)} jam
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityMeta.badgeClass}`}
                            >
                              {priorityMeta.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <span className="tabular-nums text-slate-700 font-medium">
                                {task.due_date ? String(task.due_date).slice(0, 10) : '-'}
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
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                            {task.creator?.full_name || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(task)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Lihat Detail Tugas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(task)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                    title="Ubah Tugas"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTask(task)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70 transition cursor-pointer"
                                    title="Hapus Tugas"
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

      {/* Modal Detail Tugas */}
      {detailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">Detail Tugas</h3>
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
                          (PRIORITY_STYLES[selectedTask.priority] || PRIORITY_STYLES.medium).badgeClass
                        }`}
                      >
                        Prioritas {(PRIORITY_STYLES[selectedTask.priority] || PRIORITY_STYLES.medium).label}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (STATUS_STYLES[selectedTask.status] || STATUS_STYLES.open).badgeClass
                        }`}
                      >
                        {(STATUS_STYLES[selectedTask.status] || STATUS_STYLES.open).label}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-[#1E293B]">{selectedTask.title}</h4>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {selectedTask.description || 'Tidak ada deskripsi tugas.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Departemen</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedTask.department?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pembuat Tugas</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedTask.creator?.full_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Estimasi Waktu</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {Number(selectedTask.estimated_hours || 0).toFixed(1)} jam
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tenggat Waktu</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedTask.due_date ? String(selectedTask.due_date).slice(0, 10) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Penugasan Terkait ({selectedTask.assignments_count ?? selectedTask.assignments?.length ?? 0})
                    </p>
                    {selectedTask.assignments && selectedTask.assignments.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedTask.assignments.map((assign) => (
                          <li
                            key={assign.id}
                            className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                          >
                            <span className="font-medium text-[#1E293B]">
                              {assign.employee?.full_name || `Pegawai #${assign.employee_id}`}
                            </span>
                            <span className="text-slate-500 capitalize">{assign.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Belum ada pegawai yang ditugaskan pada tugas ini.
                      </p>
                    )}
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

      {/* Modal Tambah / Ubah Tugas */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingTask ? 'Ubah Data Tugas' : 'Tambah Tugas Baru'}
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
                  Judul Tugas
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Penyusunan Laporan Kepatuhan K3 Q4"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen
                  </label>
                  <select
                    required
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="">Pilih Departemen</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi Waktu (Jam)
                  </label>
                  <input
                    type="number"
                    required
                    min="0.5"
                    max="500"
                    step="0.5"
                    value={form.estimated_hours}
                    onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Prioritas
                  </label>
                  <select
                    required
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="low">Rendah (Low)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="high">Tinggi (High)</option>
                    <option value="critical">Kritis (Critical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tenggat Waktu
                  </label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Tugas
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Tugas (Opsional)
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Rincian ruang lingkup pekerjaan atau target keluaran..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
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
                  {submitting ? 'Menyimpan...' : editingTask ? 'Simpan Perubahan' : 'Simpan Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Tugas */}
      {deletingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Tugas?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Tugas <span className="font-semibold text-[#1E293B]">{deletingTask.title}</span> akan dihapus dari perencanaan.
              {Number(deletingTask.assignments_count || 0) > 0 && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Tugas ini memiliki {deletingTask.assignments_count} penugasan terkait. Penghapusan akan ditolak jika terdapat penugasan aktif atau catatan work log.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
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
                {deleteLoading ? 'Menghapus...' : 'Hapus Tugas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
