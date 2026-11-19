import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Edit3,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { extractApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';

const STATUS_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
];

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manajer',
  employee: 'Pegawai',
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || 'PG').slice(0, 2).toUpperCase();
}

function emptyEmployeeForm(departments, positions, employmentTypes) {
  return {
    employee_code: '',
    full_name: '',
    email: '',
    password: '',
    role: 'employee',
    department_id: departments[0]?.id ? String(departments[0].id) : '',
    position_id: positions[0]?.id ? String(positions[0].id) : '',
    employment_type_id: employmentTypes[0]?.id ? String(employmentTypes[0].id) : '',
    join_date: new Date().toISOString().slice(0, 10),
    status: 'active',
  };
}

function emptyTypeForm() {
  return {
    name: '',
    work_days_per_week: '5',
    normal_weekly_hours: '40',
  };
}

export default function EmployeesPage({ readOnly = false }) {
  const [activeTab, setActiveTab] = useState('employees');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    employment_types_count: 0,
  });
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Employee Modal State
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm([], [], []));
  const [employeeFormError, setEmployeeFormError] = useState('');
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);

  // Delete Employee Modal
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [deleteEmployeeLoading, setDeleteEmployeeLoading] = useState(false);

  // Employment Type Modal State
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm());
  const [typeFormError, setTypeFormError] = useState('');
  const [typeSubmitting, setTypeSubmitting] = useState(false);

  // Delete Type Modal
  const [deletingType, setDeletingType] = useState(null);
  const [deleteTypeLoading, setDeleteTypeLoading] = useState(false);

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
      const [empRes, typesRes, deptRes, posRes] = await Promise.all([
        employeeService.getEmployees({
          search,
          status: statusFilter,
          department_id: departmentFilter,
          employment_type_id: typeFilter,
        }),
        employeeService.getEmploymentTypes(),
        employeeService.getDepartments(),
        employeeService.getPositions(),
      ]);

      setEmployees(empRes.employees || []);
      setSummary(
        empRes.summary || {
          total: 0,
          active: 0,
          inactive: 0,
          employment_types_count: (typesRes || []).length,
        }
      );
      setEmploymentTypes(typesRes || []);
      setDepartments(deptRes || []);
      setPositions(posRes || []);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data master pegawai.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, typeFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search || statusFilter || departmentFilter || typeFilter),
    [search, statusFilter, departmentFilter, typeFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDepartmentFilter('');
    setTypeFilter('');
  };

  // --- Employee CRUD Handlers ---
  const openCreateEmployeeModal = () => {
    setEditingEmployee(null);
    setEmployeeForm(emptyEmployeeForm(departments, positions, employmentTypes));
    setEmployeeFormError('');
    setEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      employee_code: emp.employee_code || '',
      full_name: emp.full_name || '',
      email: emp.user_account?.email || '',
      password: '',
      role: emp.user_account?.role || 'employee',
      department_id: String(emp.department_id || ''),
      position_id: String(emp.position_id || ''),
      employment_type_id: String(emp.employment_type_id || ''),
      join_date: emp.join_date ? String(emp.join_date).slice(0, 10) : '',
      status: emp.status || 'active',
    });
    setEmployeeFormError('');
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setEmployeeSubmitting(true);
    setEmployeeFormError('');

    const payload = {
      employee_code: employeeForm.employee_code.trim(),
      full_name: employeeForm.full_name.trim(),
      department_id: Number(employeeForm.department_id),
      position_id: Number(employeeForm.position_id),
      employment_type_id: Number(employeeForm.employment_type_id),
      join_date: employeeForm.join_date,
      status: employeeForm.status,
      role: employeeForm.role,
    };

    if (employeeForm.email.trim()) {
      payload.email = employeeForm.email.trim();
    }

    if (employeeForm.password.trim()) {
      payload.password = employeeForm.password.trim();
    }

    try {
      if (editingEmployee) {
        const res = await employeeService.updateEmployee(editingEmployee.id, payload);
        showToast('success', res.message || 'Data pegawai berhasil diperbarui.');
      } else {
        const res = await employeeService.createEmployee(payload);
        showToast('success', res.message || 'Data pegawai berhasil ditambahkan.');
      }
      setEmployeeModalOpen(false);
      await loadAllData();
    } catch (err) {
      setEmployeeFormError(extractApiError(err, 'Gagal menyimpan data pegawai.').message);
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setDeleteEmployeeLoading(true);

    try {
      const res = await employeeService.deleteEmployee(deletingEmployee.id);
      showToast('success', res.message || 'Data pegawai berhasil dihapus.');
      setDeletingEmployee(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal menghapus pegawai.').message);
      setDeletingEmployee(null);
    } finally {
      setDeleteEmployeeLoading(false);
    }
  };

  // --- Employment Type CRUD Handlers ---
  const openCreateTypeModal = () => {
    setEditingType(null);
    setTypeForm(emptyTypeForm());
    setTypeFormError('');
    setTypeModalOpen(true);
  };

  const openEditTypeModal = (typeItem) => {
    setEditingType(typeItem);
    setTypeForm({
      name: typeItem.name || '',
      work_days_per_week: String(typeItem.work_days_per_week || 5),
      normal_weekly_hours: String(typeItem.normal_weekly_hours || 40),
    });
    setTypeFormError('');
    setTypeModalOpen(true);
  };

  const handleTypeSubmit = async (e) => {
    e.preventDefault();
    setTypeSubmitting(true);
    setTypeFormError('');

    const payload = {
      name: typeForm.name.trim(),
      work_days_per_week: Number(typeForm.work_days_per_week),
      normal_weekly_hours: Number(typeForm.normal_weekly_hours),
    };

    try {
      if (editingType) {
        const res = await employeeService.updateEmploymentType(editingType.id, payload);
        showToast('success', res.message || 'Jenis kepegawaian berhasil diperbarui.');
      } else {
        const res = await employeeService.createEmploymentType(payload);
        showToast('success', res.message || 'Jenis kepegawaian berhasil ditambahkan.');
      }
      setTypeModalOpen(false);
      await loadAllData();
    } catch (err) {
      setTypeFormError(extractApiError(err, 'Gagal menyimpan jenis kepegawaian.').message);
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleConfirmDeleteType = async () => {
    if (!deletingType) return;
    setDeleteTypeLoading(true);

    try {
      const res = await employeeService.deleteEmploymentType(deletingType.id);
      showToast('success', res.message || 'Jenis kepegawaian berhasil dihapus.');
      setDeletingType(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Jenis kepegawaian tidak dapat dihapus.').message);
      setDeletingType(null);
    } finally {
      setDeleteTypeLoading(false);
    }
  };

  const kpiCards = [
    {
      label: 'Total Pegawai',
      value: summary.total,
      badge: 'Seluruh unit organisasi',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Users,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Pegawai Aktif',
      value: summary.active,
      badge: 'Akun aktif beroperasi',
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: UserCheck,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Pegawai Nonaktif',
      value: summary.inactive,
      badge: 'Akses dinonaktifkan',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
      icon: UserMinus,
      iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
    },
    {
      label: 'Jenis Kepegawaian',
      value: summary.employment_types_count,
      badge: 'Acuan jam kerja normal',
      badgeClass: 'bg-slate-100 text-slate-600',
      icon: Briefcase,
      iconBg: 'bg-slate-100 text-[#1E293B]',
    },
  ];

  return (
    <AppShell
      title={readOnly ? 'Direktori Pegawai Tim' : 'Manajemen Pegawai & Kepegawaian'}
      breadcrumb={readOnly ? 'Manajer / Direktori Master Pegawai (Read-Only)' : 'Admin / Data Master / PBI-01'}
      searchValue={search}
      onSearchChange={activeTab === 'employees' ? setSearch : undefined}
      searchPlaceholder="Cari nama, kode pegawai, atau email..."
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

        {/* Tabs Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'employees'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Data Master Pegawai (FR-02)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('employment-types')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'employment-types'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jenis Kepegawaian (FR-05)
            </button>
          </div>

          {readOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              Mode Baca Saja (Akses Manajer)
            </span>
          )}
        </div>

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

        {/* Tab 1: Data Master Pegawai (FR-02) */}
        {activeTab === 'employees' && !errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">Daftar Pegawai</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {employees.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Local Search (visible on smaller screens or always accessible) */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama / kode..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Status Filter Pills */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {STATUS_PILLS.map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setStatusFilter(pill.value)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        statusFilter === pill.value
                          ? 'bg-white text-[#1E293B] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Department Filter */}
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                  aria-label="Filter Departemen"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                {/* Employment Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                  aria-label="Filter Jenis Kepegawaian"
                >
                  <option value="">Semua Kepegawaian</option>
                  {employmentTypes.map((typeItem) => (
                    <option key={typeItem.id} value={typeItem.id}>
                      {typeItem.name}
                    </option>
                  ))}
                </select>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={openCreateEmployeeModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Pegawai</span>
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
            ) : employees.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters ? 'Tidak ada pegawai yang sesuai filter' : 'Belum ada data pegawai'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
                    : 'Tambahkan data pegawai pertama untuk mulai memantau kondisi kerja tim.'}
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
                      onClick={openCreateEmployeeModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Pegawai</span>
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
                      <th className="py-3 px-4 font-semibold">Pegawai</th>
                      <th className="py-3 px-4 font-semibold">Kode</th>
                      <th className="py-3 px-4 font-semibold">Departemen & Jabatan</th>
                      <th className="py-3 px-4 font-semibold">Jenis Kepegawaian</th>
                      <th className="py-3 px-4 font-semibold">Tgl Bergabung</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      {!readOnly && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#E0F2FE] text-[#0369A1] text-xs font-bold flex items-center justify-center shrink-0">
                              {getInitials(emp.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1E293B] truncate">{emp.full_name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {emp.user_account?.email || 'Tanpa akun login'}
                                {emp.user_account?.role && (
                                  <span className="ml-1.5 text-[#0284C7] font-medium">
                                    ({ROLE_LABELS[emp.user_account.role] || emp.user_account.role})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium tabular-nums text-[#1E293B] whitespace-nowrap">
                          {emp.employee_code}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#1E293B]">{emp.position?.title || '-'}</p>
                          <p className="text-xs text-slate-500">{emp.department?.name || '-'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#1E293B]">
                            {emp.employment_type?.name || '-'}
                          </p>
                          {emp.employment_type && (
                            <p className="text-xs text-slate-500 tabular-nums">
                              {emp.employment_type.work_days_per_week} hari/mgg •{' '}
                              {emp.employment_type.normal_weekly_hours} jam/mgg
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums whitespace-nowrap text-slate-600">
                          {emp.join_date ? String(emp.join_date).slice(0, 10) : '-'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {emp.status === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B91C1C]">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        {!readOnly && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditEmployeeModal(emp)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Ubah Pegawai"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingEmployee(emp)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70 transition cursor-pointer"
                                title="Hapus Pegawai"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Jenis Kepegawaian (FR-05) */}
        {activeTab === 'employment-types' && !errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">
                  Daftar Jenis Kepegawaian (FR-05)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {employmentTypes.length}
                </span>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={openCreateTypeModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Jenis Kepegawaian</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : employmentTypes.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">Belum ada jenis kepegawaian</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tambahkan kategori hubungan kerja untuk menetapkan standar hari dan jam kerja normal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[#64748B] text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Nama Jenis Kepegawaian</th>
                      <th className="py-3 px-4 font-semibold">Hari Kerja / Minggu</th>
                      <th className="py-3 px-4 font-semibold">Ambang Lembur Harian</th>
                      <th className="py-3 px-4 font-semibold">Jam Kerja Normal / Minggu</th>
                      <th className="py-3 px-4 font-semibold">Pegawai Terkait</th>
                      {!readOnly && <th className="py-3 px-4 font-semibold text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {employmentTypes.map((typeItem) => {
                      const inUse = Number(typeItem.employees_count || 0) > 0;
                      const dailyLimit = Number(typeItem.work_days_per_week) === 6 ? 7 : 8;
                      return (
                        <tr
                          key={typeItem.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-[#1E293B]">
                            {typeItem.name}
                          </td>
                          <td className="py-3.5 px-4 tabular-nums">
                            {typeItem.work_days_per_week} hari/minggu
                          </td>
                          <td className="py-3.5 px-4 tabular-nums text-slate-600">
                            &gt; {dailyLimit} jam/hari (PP 35/2021)
                          </td>
                          <td className="py-3.5 px-4 tabular-nums font-medium text-[#1E293B]">
                            {typeItem.normal_weekly_hours} jam
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                                inUse
                                  ? 'bg-[#E0F2FE] text-[#0369A1]'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                              title={
                                inUse
                                  ? 'Tidak dapat dihapus karena masih direferensikan oleh data pegawai aktif'
                                  : 'Belum digunakan oleh pegawai'
                              }
                            >
                              {inUse && <Lock className="w-3 h-3" />}
                              {typeItem.employees_count || 0} pegawai
                            </span>
                          </td>
                          {!readOnly && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditTypeModal(typeItem)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                  title="Ubah Jenis Kepegawaian"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingType(typeItem)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    inUse
                                      ? 'text-slate-400 hover:text-[#B45309] hover:bg-[#FEF3C7]/70'
                                      : 'text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70'
                                  }`}
                                  title={
                                    inUse
                                      ? 'Masih digunakan oleh pegawai (penghapusan ditolak sistem)'
                                      : 'Hapus Jenis Kepegawaian'
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

      {/* Modal Tambah / Ubah Pegawai */}
      {employeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingEmployee ? 'Ubah Data Pegawai' : 'Tambah Pegawai Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setEmployeeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="p-6 space-y-4">
              {employeeFormError && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{employeeFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Pegawai
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeForm.employee_code}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, employee_code: e.target.value })
                    }
                    placeholder="EMP-006"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeForm.full_name}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, full_name: e.target.value })
                    }
                    placeholder="Nama lengkap pegawai"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen
                  </label>
                  <select
                    required
                    value={employeeForm.department_id}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, department_id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="">Pilih Departemen</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan / Posisi
                  </label>
                  <select
                    required
                    value={employeeForm.position_id}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, position_id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="">Pilih Jabatan</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Kepegawaian
                  </label>
                  <select
                    required
                    value={employeeForm.employment_type_id}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, employment_type_id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="">Pilih Jenis Kepegawaian</option>
                    {employmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Bergabung
                  </label>
                  <input
                    type="date"
                    required
                    value={employeeForm.join_date}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, join_date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Akun
                  </label>
                  <input
                    type="email"
                    value={employeeForm.email}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, email: e.target.value })
                    }
                    placeholder="pegawai@workbalance.id"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingEmployee ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi Awal'}
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={employeeForm.password}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, password: e.target.value })
                    }
                    placeholder={editingEmployee ? 'Kosongkan jika tetap' : 'Min. 8 karakter (default password123)'}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran Akses (RBAC)
                  </label>
                  <select
                    value={employeeForm.role}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, role: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="employee">Pegawai</option>
                    <option value="manager">Manajer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Keaktifan
                  </label>
                  <select
                    value={employeeForm.status}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={employeeSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition cursor-pointer"
                >
                  {employeeSubmitting ? 'Menyimpan...' : editingEmployee ? 'Simpan Perubahan' : 'Simpan Pegawai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pegawai */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Data Pegawai?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Data pegawai <span className="font-semibold text-[#1E293B]">{deletingEmployee.full_name}</span>{' '}
              (<span className="tabular-nums">{deletingEmployee.employee_code}</span>) beserta akun login terkait akan dihapus secara permanen.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteEmployeeLoading}
                onClick={handleConfirmDeleteEmployee}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#EF4444] hover:bg-red-600 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {deleteEmployeeLoading ? 'Menghapus...' : 'Hapus Pegawai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Ubah Jenis Kepegawaian */}
      {typeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingType ? 'Ubah Jenis Kepegawaian' : 'Tambah Jenis Kepegawaian'}
              </h3>
              <button
                type="button"
                onClick={() => setTypeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="p-6 space-y-4">
              {typeFormError && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{typeFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Jenis Kepegawaian
                </label>
                <input
                  type="text"
                  required
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="Misal: Tetap (PKWTT)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hari Kerja / Minggu
                  </label>
                  <select
                    value={typeForm.work_days_per_week}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, work_days_per_week: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="5">5 Hari (8 jam/hari)</option>
                    <option value="6">6 Hari (7 jam/hari)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Normal / Minggu
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    required
                    value={typeForm.normal_weekly_hours}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, normal_weekly_hours: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setTypeModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={typeSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {typeSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Jenis Kepegawaian */}
      {deletingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Jenis Kepegawaian?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Anda akan menghapus kategori{' '}
              <span className="font-semibold text-[#1E293B]">{deletingType.name}</span>.
              {Number(deletingType.employees_count || 0) > 0 && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Jenis kepegawaian ini masih digunakan oleh {deletingType.employees_count}{' '}
                  pegawai. Sistem akan menolak penghapusan untuk menjaga integritas data.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingType(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteTypeLoading}
                onClick={handleConfirmDeleteType}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#EF4444] hover:bg-red-600 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {deleteTypeLoading ? 'Memproses...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
