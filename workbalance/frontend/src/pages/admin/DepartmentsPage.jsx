import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit3,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { extractApiError } from '../../services/api';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';

const MANAGER_FILTER_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'with_manager', label: 'Memiliki Manajer' },
  { value: 'without_manager', label: 'Belum Ada Manajer' },
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || 'DP').slice(0, 2).toUpperCase();
}

function emptyDepartmentForm() {
  return {
    code: '',
    name: '',
    manager_id: '',
    description: '',
  };
}

export default function DepartmentsPage({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [departments, setDepartments] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Create/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form, setForm] = useState(emptyDepartmentForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deletingDepartment, setDeletingDepartment] = useState(null);
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

    const hasFilters = Boolean(search.trim() || managerFilter);

    try {
      const [filteredDepts, unfilteredDepts, empRes] = await Promise.all([
        departmentService.getDepartments({
          search: search.trim(),
          has_manager: managerFilter,
        }),
        hasFilters ? departmentService.getDepartments() : Promise.resolve(null),
        !readOnly ? employeeService.getEmployees({ status: 'active' }) : Promise.resolve({ employees: [] }),
      ]);

      const deptList = filteredDepts || [];
      setDepartments(deptList);
      setAllDepartments(unfilteredDepts || deptList);
      setActiveEmployees(empRes?.employees || []);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data departemen organisasi.').message);
    } finally {
      setLoading(false);
    }
  }, [search, managerFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || managerFilter),
    [search, managerFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setManagerFilter('');
  };

  const stats = useMemo(() => {
    const totalDepartments = allDepartments.length;
    const withManager = allDepartments.filter((dept) => Boolean(dept.manager_id)).length;
    const totalEmployees = allDepartments.reduce(
      (sum, dept) => sum + Number(dept.employees_count || 0),
      0
    );
    const avgEmployees = totalDepartments > 0 ? (totalEmployees / totalDepartments).toFixed(1) : '0.0';

    return {
      totalDepartments,
      withManager,
      totalEmployees,
      avgEmployees,
    };
  }, [allDepartments]);

  const managerOptions = useMemo(() => {
    if (!editingDepartment?.manager) {
      return activeEmployees;
    }

    const exists = activeEmployees.some((emp) => emp.id === editingDepartment.manager.id);
    if (exists) {
      return activeEmployees;
    }

    return [editingDepartment.manager, ...activeEmployees];
  }, [activeEmployees, editingDepartment]);

  const openCreateModal = () => {
    setEditingDepartment(null);
    setForm(emptyDepartmentForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (dept) => {
    setEditingDepartment(dept);
    setForm({
      code: dept.code || '',
      name: dept.name || '',
      manager_id: dept.manager_id ? String(dept.manager_id) : '',
      description: dept.description || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      description: form.description.trim() || null,
    };

    try {
      if (editingDepartment) {
        const res = await departmentService.updateDepartment(editingDepartment.id, payload);
        showToast('success', res.message || 'Data departemen berhasil diperbarui.');
      } else {
        const res = await departmentService.createDepartment(payload);
        showToast('success', res.message || 'Data departemen berhasil ditambahkan.');
      }
      setModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan data departemen.').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDepartment) return;
    setDeleteLoading(true);

    try {
      const res = await departmentService.deleteDepartment(deletingDepartment.id);
      showToast('success', res.message || 'Data departemen berhasil dihapus.');
      setDeletingDepartment(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Departemen tidak dapat dihapus.').message);
      setDeletingDepartment(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const kpiCards = [
    {
      label: 'Total Departemen',
      value: stats.totalDepartments,
      badge: 'Unit struktur organisasi',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Building2,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Departemen Dengan Manajer',
      value: stats.withManager,
      badge: 'Memiliki penanggung jawab tim',
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: UserCheck,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Total Pegawai Terkelompok',
      value: stats.totalEmployees,
      badge: 'Tersebar di seluruh unit',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Users,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Rata-rata Pegawai / Unit',
      value: stats.avgEmployees,
      badge: 'Kepadatan anggota departemen',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
      icon: Building2,
      iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
    },
  ];

  return (
    <AppShell
      title={readOnly ? 'Struktur Departemen Organisasi' : 'Manajemen Data Departemen'}
      breadcrumb={
        readOnly
          ? 'Manajer / Struktur Departemen (Read-Only)'
          : 'Admin / Data Master / PBI-02 (FR-03)'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari kode, nama departemen, atau manajer..."
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
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
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

        {/* Read-only notice for Manager */}
        {readOnly && (
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              Mode Baca Saja (Akses Manajer)
            </span>
          </div>
        )}

        {/* Error State Banner */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Data</h2>
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

        {/* Department Data Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">Daftar Departemen (FR-03)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {departments.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Local Search */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari kode, nama, atau manajer..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Manager Filter Pills */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {MANAGER_FILTER_PILLS.map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setManagerFilter(pill.value)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        managerFilter === pill.value
                          ? 'bg-white text-[#1E293B] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Departemen</span>
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
            ) : departments.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters
                    ? 'Tidak ada departemen yang sesuai filter'
                    : 'Belum ada data departemen'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
                    : 'Tambahkan unit departemen untuk mengelompokkan pegawai dan analisis Decent Work Score.'}
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
                      <span>Tambah Departemen</span>
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
                      <th className="py-3 px-4 font-semibold">Kode</th>
                      <th className="py-3 px-4 font-semibold">Departemen</th>
                      <th className="py-3 px-4 font-semibold">Manajer Departemen</th>
                      <th className="py-3 px-4 font-semibold">Pegawai Terkait</th>
                      <th className="py-3 px-4 font-semibold">Tugas Terkait</th>
                      {!readOnly && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {departments.map((dept) => {
                      const employeesCount = Number(dept.employees_count || 0);
                      const activeCount = Number(dept.active_employees_count || 0);
                      const tasksCount = Number(dept.tasks_count || 0);
                      const inUse = employeesCount > 0 || tasksCount > 0;

                      return (
                        <tr
                          key={dept.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums bg-[#E0F2FE] text-[#0369A1]">
                              {dept.code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 max-w-md">
                            <p className="font-semibold text-[#1E293B]">{dept.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {dept.description || 'Belum ada deskripsi departemen.'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {dept.manager ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#D1FAE5] text-[#047857] text-xs font-bold flex items-center justify-center shrink-0">
                                  {getInitials(dept.manager.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-[#1E293B] truncate">
                                    {dept.manager.full_name}
                                  </p>
                                  <p className="text-xs text-slate-500 tabular-nums truncate">
                                    {dept.manager.employee_code}
                                    {dept.manager.position?.title
                                      ? ` • ${dept.manager.position.title}`
                                      : ''}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#B45309]">
                                Belum Ditentukan
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                                  employeesCount > 0
                                    ? 'bg-[#E0F2FE] text-[#0369A1]'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                                title={
                                  employeesCount > 0
                                    ? 'Tidak dapat dihapus karena masih memiliki pegawai terdaftar'
                                    : 'Belum memiliki pegawai terdaftar'
                                }
                              >
                                {employeesCount > 0 && <Lock className="w-3 h-3" />}
                                {employeesCount} pegawai
                              </span>
                              {employeesCount > 0 && (
                                <span className="text-[11px] text-slate-500 tabular-nums pl-1">
                                  {activeCount} aktif
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-xs font-medium text-slate-600 tabular-nums">
                              {tasksCount} tugas
                            </span>
                          </td>
                          {!readOnly && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(dept)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                  title="Ubah Departemen"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingDepartment(dept)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    inUse
                                      ? 'text-slate-400 hover:text-[#B45309] hover:bg-[#FEF3C7]/70'
                                      : 'text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70'
                                  }`}
                                  title={
                                    inUse
                                      ? 'Masih memiliki relasi aktif (penghapusan ditolak sistem)'
                                      : 'Hapus Departemen'
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
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

      {/* Modal Tambah / Ubah Departemen */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingDepartment ? 'Ubah Data Departemen' : 'Tambah Departemen Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Departemen
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="FIN"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Departemen
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Keuangan & Akuntansi"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manajer Departemen (Opsional)
                </label>
                <select
                  value={form.manager_id}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {managerOptions.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code})
                      {emp.position?.title ? ` — ${emp.position.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Unit / Fungsi (Opsional)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ringkasan ruang lingkup tanggung jawab departemen..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                    : editingDepartment
                    ? 'Simpan Perubahan'
                    : 'Simpan Departemen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Departemen */}
      {deletingDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Data Departemen?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Anda akan menghapus departemen{' '}
              <span className="font-semibold text-[#1E293B]">{deletingDepartment.name}</span> (
              <span className="tabular-nums">{deletingDepartment.code}</span>).
              {(Number(deletingDepartment.employees_count || 0) > 0 ||
                Number(deletingDepartment.tasks_count || 0) > 0) && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Departemen ini masih memiliki{' '}
                  {deletingDepartment.employees_count || 0} pegawai dan{' '}
                  {deletingDepartment.tasks_count || 0} tugas terkait. Sistem akan menolak
                  penghapusan untuk menjaga integritas data.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingDepartment(null)}
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
                {deleteLoading ? 'Memproses...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
