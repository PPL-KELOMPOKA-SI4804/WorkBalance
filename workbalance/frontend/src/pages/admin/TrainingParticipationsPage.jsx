import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  GraduationCap,
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
import { trainingParticipationService } from '../../services/trainingParticipationService';
import { trainingService } from '../../services/trainingService';

const STATUS_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

const STATUS_STYLES = {
  enrolled: { label: 'Enrolled', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  completed: { label: 'Completed', badgeClass: 'bg-[#D1FAE5] text-[#047857]' },
  dropped: { label: 'Dropped', badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]' },
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || 'PG').slice(0, 2).toUpperCase();
}

function emptyParticipationForm(trainings = [], employees = []) {
  return {
    training_id: trainings[0]?.id ? String(trainings[0].id) : '',
    employee_id: employees[0]?.id ? String(employees[0].id) : '',
    status: 'enrolled',
    completion_date: new Date().toISOString().slice(0, 10),
  };
}

export default function TrainingParticipationsPage({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [participations, setParticipations] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    enrolled: 0,
    completed: 0,
    dropped: 0,
    trained_employees_count: 0,
    training_coverage_rate: 0,
  });

  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trainingFilter, setTrainingFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState(null);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingParticipation, setEditingParticipation] = useState(null);
  const [form, setForm] = useState(emptyParticipationForm([], []));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingParticipation, setDeletingParticipation] = useState(null);
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
      const [partRes, trainingsRes, empRes, deptRes] = await Promise.all([
        trainingParticipationService.getTrainingParticipations({
          search: search.trim(),
          status: statusFilter,
          training_id: !readOnly ? trainingFilter : '',
          department_id: !readOnly ? departmentFilter : '',
        }),
        !readOnly ? trainingService.getTrainings() : Promise.resolve(null),
        !readOnly ? employeeService.getEmployees({ status: 'active' }) : Promise.resolve(null),
        !readOnly ? departmentService.getDepartments() : Promise.resolve(null),
      ]);

      setParticipations(partRes?.participations || []);
      setSummary(
        partRes?.summary || {
          total: 0,
          enrolled: 0,
          completed: 0,
          dropped: 0,
          trained_employees_count: 0,
          training_coverage_rate: 0,
        }
      );

      if (!readOnly) {
        setTrainings(trainingsRes?.trainings || []);
        setEmployees(empRes?.employees || []);
        setDepartments(deptRes || []);
      }
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data keikutsertaan pelatihan.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, trainingFilter, departmentFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || trainingFilter || departmentFilter),
    [search, statusFilter, trainingFilter, departmentFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTrainingFilter('');
    setDepartmentFilter('');
  };

  // --- Detail Handler ---
  const openDetailModal = async (item) => {
    setSelectedParticipation(item);
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const detail = await trainingParticipationService.getTrainingParticipation(item.id);
      setSelectedParticipation(detail);
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal memuat detail keikutsertaan pelatihan.').message);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create / Edit Handlers ---
  const openCreateModal = () => {
    setEditingParticipation(null);
    setForm(emptyParticipationForm(trainings, employees));
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingParticipation(item);
    setForm({
      training_id: String(item.training_id || ''),
      employee_id: String(item.employee_id || ''),
      status: item.status || 'enrolled',
      completion_date: item.completion_date
        ? String(item.completion_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      training_id: Number(form.training_id),
      employee_id: Number(form.employee_id),
      status: form.status,
      completion_date: form.status === 'completed' ? form.completion_date : null,
    };

    try {
      if (editingParticipation) {
        const res = await trainingParticipationService.updateTrainingParticipation(
          editingParticipation.id,
          payload
        );
        showToast('success', res.message || 'Status keikutsertaan pelatihan berhasil diperbarui.');
      } else {
        const res = await trainingParticipationService.createTrainingParticipation(payload);
        showToast('success', res.message || 'Pegawai berhasil didaftarkan ke program pelatihan.');
      }
      setFormModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan data keikutsertaan pelatihan.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingParticipation) return;
    setDeleteLoading(true);

    try {
      const res = await trainingParticipationService.deleteTrainingParticipation(
        deletingParticipation.id
      );
      showToast('success', res.message || 'Data keikutsertaan pelatihan berhasil dihapus.');
      setDeletingParticipation(null);
      await loadAllData();
    } catch (err) {
      showToast(
        'error',
        extractApiError(err, 'Data keikutsertaan pelatihan tidak dapat dihapus.').message
      );
      setDeletingParticipation(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const kpiCards = [
    {
      label: 'Total Keikutsertaan',
      value: summary.total,
      badge: 'Seluruh pendaftaran pelatihan',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Users,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Peserta Terdaftar (Enrolled)',
      value: summary.enrolled,
      badge: 'Sedang mengikuti program',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Clock,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Lulus Pelatihan (Completed)',
      value: summary.completed,
      badge: `${summary.dropped} peserta dropped`,
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: CheckCircle2,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: readOnly ? 'Status Keikutsertaan' : 'Cakupan Pegawai Terlatih',
      value: `${Number(summary.training_coverage_rate || 0).toFixed(1)}%`,
      badge: readOnly
        ? `${summary.completed} program telah lulus`
        : `${summary.trained_employees_count} pegawai mengikuti ≥ 1 pelatihan`,
      badgeClass:
        Number(summary.training_coverage_rate) >= 75
          ? 'bg-[#D1FAE5] text-[#047857]'
          : 'bg-[#FEF3C7] text-[#B45309]',
      icon: Award,
      iconBg:
        Number(summary.training_coverage_rate) >= 75
          ? 'bg-[#D1FAE5] text-[#10B981]'
          : 'bg-[#FEF3C7] text-[#F59E0B]',
    },
  ];

  return (
    <AppShell
      title={readOnly ? 'Pelatihan Saya' : 'Keikutsertaan Pelatihan'}
      breadcrumb={
        readOnly
          ? 'Pegawai / Riwayat & Status Pelatihan Pribadi'
          : 'Pengembangan Kompetensi / Pendaftaran & Kelulusan / PBI-06'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari nama pegawai, kode, atau judul pelatihan..."
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
              Mode Baca Saja: Menampilkan program pelatihan yang Anda ikuti beserta status kelulusan Anda.
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
                <h2 className="text-sm font-semibold text-[#1E293B]">
                  Gagal Memuat Data Keikutsertaan Pelatihan
                </h2>
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

        {/* Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">
                  Daftar Keikutsertaan Pelatihan
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {participations.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari peserta / pelatihan..."
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
                  <>
                    <select
                      value={trainingFilter}
                      onChange={(e) => setTrainingFilter(e.target.value)}
                      aria-label="Filter Program Pelatihan"
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none max-w-[200px]"
                    >
                      <option value="">Semua Pelatihan</option>
                      {trainings.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
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

                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Daftarkan Peserta</span>
                    </button>
                  </>
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
            ) : participations.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters
                    ? 'Tidak ada data keikutsertaan yang sesuai filter'
                    : 'Belum ada pendaftaran pelatihan'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat data peserta pelatihan.'
                    : readOnly
                      ? 'Anda belum terdaftar pada program pelatihan mana pun saat ini.'
                      : 'Daftarkan pegawai ke program pelatihan untuk memantau perkembangan dan kelulusan kompetensi.'}
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
                      <span>Daftarkan Peserta</span>
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
                      <th className="py-3 px-4 font-semibold">Pegawai Peserta</th>
                      <th className="py-3 px-4 font-semibold">Program Pelatihan</th>
                      <th className="py-3 px-4 font-semibold">Durasi & Jadwal</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Tanggal Kelulusan</th>
                      <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {participations.map((item) => {
                      const statusMeta = STATUS_STYLES[item.status] || STATUS_STYLES.enrolled;
                      const isCompleted = item.status === 'completed';

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
                                  {item.employee?.department?.name || '-'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-semibold text-[#1E293B] truncate">
                              {item.training?.title || '-'}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] text-[11px] font-medium">
                                {item.training?.category || '-'}
                              </span>
                              <span className="text-xs text-slate-500 truncate">
                                {item.training?.provider || '-'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="font-semibold text-[#1E293B] tabular-nums">
                              {Number(item.training?.duration_hours || 0).toFixed(1)} jam
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {item.training?.start_date
                                ? String(item.training.start_date).slice(0, 10)
                                : '-'}{' '}
                              s.d.{' '}
                              {item.training?.end_date
                                ? String(item.training.end_date).slice(0, 10)
                                : '-'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 tabular-nums whitespace-nowrap text-slate-600">
                            {item.completion_date ? String(item.completion_date).slice(0, 10) : '-'}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Lihat Detail Keikutsertaan"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                    title="Ubah Status Keikutsertaan"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingParticipation(item)}
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                      isCompleted
                                        ? 'text-slate-400 hover:text-[#B45309] hover:bg-[#FEF3C7]/70'
                                        : 'text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70'
                                    }`}
                                    title={
                                      isCompleted
                                        ? 'Peserta sudah lulus (riwayat kelulusan dilindungi)'
                                        : 'Hapus Pendaftaran'
                                    }
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

      {/* Modal Detail Keikutsertaan */}
      {detailModalOpen && selectedParticipation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">Detail Keikutsertaan Pelatihan</h3>
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
                          (STATUS_STYLES[selectedParticipation.status] || STATUS_STYLES.enrolled)
                            .badgeClass
                        }`}
                      >
                        {
                          (STATUS_STYLES[selectedParticipation.status] || STATUS_STYLES.enrolled)
                            .label
                        }
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E0F2FE] text-[#0369A1]">
                        {selectedParticipation.training?.category || '-'}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-[#1E293B]">
                      {selectedParticipation.training?.title || '-'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Penyelenggara: {selectedParticipation.training?.provider || '-'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Pegawai Peserta</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedParticipation.employee?.full_name || '-'}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {selectedParticipation.employee?.employee_code || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Departemen & Jabatan</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedParticipation.employee?.department?.name || '-'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedParticipation.employee?.position?.title || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Durasi Program</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {Number(selectedParticipation.training?.duration_hours || 0).toFixed(1)} jam
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tanggal Kelulusan</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {selectedParticipation.completion_date
                          ? String(selectedParticipation.completion_date).slice(0, 10)
                          : 'Belum selesai'}
                      </p>
                    </div>
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

      {/* Modal Tambah / Ubah Keikutsertaan */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingParticipation
                  ? 'Ubah Status Keikutsertaan Pelatihan'
                  : 'Daftarkan Peserta Pelatihan'}
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
                  Program Pelatihan
                </label>
                <select
                  required
                  value={form.training_id}
                  onChange={(e) => setForm({ ...form, training_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                >
                  <option value="">Pilih Program Pelatihan</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({Number(t.duration_hours).toFixed(1)}j)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pegawai Peserta
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
                    Status Keikutsertaan
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="enrolled">Enrolled (Terdaftar)</option>
                    <option value="completed">Completed (Lulus)</option>
                    <option value="dropped">Dropped (Batal/Mundur)</option>
                  </select>
                </div>

                {form.status === 'completed' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Kelulusan
                    </label>
                    <input
                      type="date"
                      required
                      value={form.completion_date}
                      onChange={(e) => setForm({ ...form, completion_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                    />
                  </div>
                )}
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
                    : editingParticipation
                      ? 'Simpan Perubahan'
                      : 'Daftarkan Peserta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deletingParticipation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Data Keikutsertaan?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Pendaftaran{' '}
              <span className="font-semibold text-[#1E293B]">
                {deletingParticipation.employee?.full_name}
              </span>{' '}
              pada pelatihan{' '}
              <span className="font-semibold text-[#1E293B]">
                {deletingParticipation.training?.title}
              </span>{' '}
              akan dihapus.
              {deletingParticipation.status === 'completed' && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Peserta sudah berstatus Lulus (Completed). Penghapusan akan ditolak sistem untuk menjaga riwayat kompetensi pegawai.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingParticipation(null)}
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
