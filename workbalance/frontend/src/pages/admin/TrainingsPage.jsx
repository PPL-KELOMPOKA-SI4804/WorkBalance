import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
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
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { extractApiError } from '../../services/api';
import { trainingService } from '../../services/trainingService';

const SCHEDULE_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'ongoing', label: 'Sedang Berjalan' },
  { value: 'upcoming', label: 'Akan Datang' },
  { value: 'ended', label: 'Selesai' },
];

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Teknis & Rekayasa',
  'Keselamatan & K3',
  'Kepemimpinan & Manajemen',
  'Kesejahteraan & Produktivitas',
];

function getScheduleMeta(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) {
    return { label: 'Terjadwal', badgeClass: 'bg-slate-100 text-slate-600' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${String(startDateStr).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDateStr).slice(0, 10)}T00:00:00`);

  if (today < start) {
    return { label: 'Akan Datang', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' };
  }

  if (today > end) {
    return { label: 'Selesai', badgeClass: 'bg-slate-100 text-slate-600' };
  }

  return { label: 'Sedang Berjalan', badgeClass: 'bg-[#D1FAE5] text-[#047857]' };
}

function emptyTrainingForm() {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    title: '',
    category: 'Teknis & Rekayasa',
    provider: '',
    duration_hours: '8',
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export default function TrainingsPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [trainings, setTrainings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    upcoming: 0,
    ongoing: 0,
    ended: 0,
    total_duration_hours: 0,
    total_participations: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [form, setForm] = useState(emptyTrainingForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingTraining, setDeletingTraining] = useState(null);
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
      const data = await trainingService.getTrainings({
        search: search.trim(),
        schedule_status: scheduleFilter,
        category: categoryFilter,
      });

      setTrainings(data?.trainings || []);
      setCategories(data?.categories || []);
      setSummary(
        data?.summary || {
          total: 0,
          upcoming: 0,
          ongoing: 0,
          ended: 0,
          total_duration_hours: 0,
          total_participations: 0,
        }
      );
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat katalog pelatihan.').message);
    } finally {
      setLoading(false);
    }
  }, [search, scheduleFilter, categoryFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || scheduleFilter || categoryFilter),
    [search, scheduleFilter, categoryFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setScheduleFilter('');
    setCategoryFilter('');
  };

  const categorySuggestions = useMemo(() => {
    const merged = new Set([...DEFAULT_CATEGORY_SUGGESTIONS, ...categories]);
    return Array.from(merged);
  }, [categories]);

  // --- Detail Handler ---
  const openDetailModal = async (training) => {
    setSelectedTraining(training);
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const detail = await trainingService.getTraining(training.id);
      setSelectedTraining(detail);
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal memuat detail program pelatihan.').message);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create / Edit Handlers ---
  const openCreateModal = () => {
    setEditingTraining(null);
    setForm(emptyTrainingForm());
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (training) => {
    setEditingTraining(training);
    setForm({
      title: training.title || '',
      category: training.category || '',
      provider: training.provider || '',
      duration_hours: String(Number(training.duration_hours || 1)),
      start_date: training.start_date ? String(training.start_date).slice(0, 10) : '',
      end_date: training.end_date ? String(training.end_date).slice(0, 10) : '',
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (form.end_date < form.start_date) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      provider: form.provider.trim(),
      duration_hours: Number(form.duration_hours),
      start_date: form.start_date,
      end_date: form.end_date,
    };

    try {
      if (editingTraining) {
        const res = await trainingService.updateTraining(editingTraining.id, payload);
        showToast('success', res.message || 'Program pelatihan berhasil diperbarui.');
      } else {
        const res = await trainingService.createTraining(payload);
        showToast('success', res.message || 'Program pelatihan berhasil ditambahkan.');
      }
      setFormModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan program pelatihan.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingTraining) return;
    setDeleteLoading(true);

    try {
      const res = await trainingService.deleteTraining(deletingTraining.id);
      showToast('success', res.message || 'Program pelatihan berhasil dihapus.');
      setDeletingTraining(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Program pelatihan tidak dapat dihapus.').message);
      setDeletingTraining(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const activeScheduleCount = Number(summary.ongoing || 0) + Number(summary.upcoming || 0);

  const kpiCards = [
    {
      label: 'Total Program Pelatihan',
      value: summary.total,
      badge: `${categories.length} kategori terdokumentasi`,
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: GraduationCap,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Berlangsung & Akan Datang',
      value: activeScheduleCount,
      badge: `${summary.ongoing} berlangsung • ${summary.upcoming} mendatang`,
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: Calendar,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Total Durasi Kurikulum',
      value: `${Number(summary.total_duration_hours || 0).toFixed(1)} jam`,
      badge: 'Akumulasi jam pelatihan',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
      icon: Clock,
      iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
    },
    {
      label: 'Total Partisipasi Peserta',
      value: summary.total_participations,
      badge: 'Keikutsertaan pegawai',
      badgeClass: 'bg-slate-100 text-slate-600',
      icon: Users,
      iconBg: 'bg-slate-100 text-[#1E293B]',
    },
  ];

  return (
    <AppShell
      title="Katalog Pelatihan"
      breadcrumb="Pengembangan Kompetensi / Katalog Pelatihan / PBI-05"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari judul pelatihan, kategori, atau penyelenggara..."
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

        {/* Error State */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Katalog Pelatihan</h2>
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

        {/* Catalog Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">Daftar Program Pelatihan</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {trainings.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari pelatihan..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Schedule Filter Pills */}
                <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
                  {SCHEDULE_PILLS.map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setScheduleFilter(pill.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        scheduleFilter === pill.value
                          ? 'bg-white text-[#1E293B] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter Kategori Pelatihan"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pelatihan</span>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : trainings.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters
                    ? 'Tidak ada program pelatihan yang sesuai filter'
                    : 'Belum ada program pelatihan di katalog'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Coba ubah kata kunci pencarian atau setel ulang filter jadwal/kategori.'
                    : 'Tambahkan program pelatihan baru untuk mendokumentasikan pengembangan kompetensi tim.'}
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
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Pelatihan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Success State Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[#64748B] text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Program Pelatihan</th>
                      <th className="py-3 px-4 font-semibold">Penyelenggara</th>
                      <th className="py-3 px-4 font-semibold">Durasi</th>
                      <th className="py-3 px-4 font-semibold">Jadwal Pelaksanaan</th>
                      <th className="py-3 px-4 font-semibold">Status Jadwal</th>
                      <th className="py-3 px-4 font-semibold">Peserta</th>
                      <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {trainings.map((item) => {
                      const scheduleMeta = getScheduleMeta(item.start_date, item.end_date);
                      const inUse = Number(item.participations_count || 0) > 0;

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 max-w-sm">
                            <p className="font-semibold text-[#1E293B]">{item.title}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] text-[11px] font-medium">
                              {item.category}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                            {item.provider}
                          </td>

                          <td className="py-3.5 px-4 tabular-nums font-semibold text-[#1E293B] whitespace-nowrap">
                            {Number(item.duration_hours || 0).toFixed(1)} jam
                          </td>

                          <td className="py-3.5 px-4 tabular-nums whitespace-nowrap text-xs text-slate-600">
                            <span className="font-medium text-[#1E293B]">
                              {item.start_date ? String(item.start_date).slice(0, 10) : '-'}
                            </span>{' '}
                            s.d.{' '}
                            <span className="font-medium text-[#1E293B]">
                              {item.end_date ? String(item.end_date).slice(0, 10) : '-'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scheduleMeta.badgeClass}`}
                            >
                              {scheduleMeta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                                inUse
                                  ? 'bg-[#E0F2FE] text-[#0369A1]'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                              title={
                                inUse
                                  ? 'Tidak dapat dihapus karena masih memiliki data keikutsertaan pegawai'
                                  : 'Belum memiliki peserta terdaftar'
                              }
                            >
                              {inUse && <Lock className="w-3 h-3" />}
                              {item.participations_count || 0} peserta
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Lihat Detail Pelatihan"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                title="Ubah Pelatihan"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTraining(item)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  inUse
                                    ? 'text-slate-400 hover:text-[#B45309] hover:bg-[#FEF3C7]/70'
                                    : 'text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70'
                                }`}
                                title={
                                  inUse
                                    ? 'Masih memiliki peserta terdaftar (penghapusan ditolak sistem)'
                                    : 'Hapus Pelatihan'
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      {/* Modal Detail Pelatihan */}
      {detailModalOpen && selectedTraining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">Detail Program Pelatihan</h3>
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
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E0F2FE] text-[#0369A1]">
                        {selectedTraining.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getScheduleMeta(selectedTraining.start_date, selectedTraining.end_date).badgeClass
                        }`}
                      >
                        {getScheduleMeta(selectedTraining.start_date, selectedTraining.end_date).label}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-[#1E293B]">{selectedTraining.title}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Penyelenggara</p>
                      <p className="font-semibold text-[#1E293B] mt-0.5">
                        {selectedTraining.provider}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Durasi Pelatihan</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {Number(selectedTraining.duration_hours || 0).toFixed(1)} jam
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tanggal Mulai</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {selectedTraining.start_date ? String(selectedTraining.start_date).slice(0, 10) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tanggal Selesai</p>
                      <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                        {selectedTraining.end_date ? String(selectedTraining.end_date).slice(0, 10) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Daftar Peserta ({selectedTraining.participations_count ?? selectedTraining.participations?.length ?? 0})
                    </p>
                    {selectedTraining.participations && selectedTraining.participations.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedTraining.participations.map((part) => (
                          <li
                            key={part.id}
                            className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                          >
                            <div>
                              <span className="font-medium text-[#1E293B]">
                                {part.employee?.full_name || `Pegawai #${part.employee_id}`}
                              </span>
                              <span className="text-slate-500 ml-1.5">
                                ({part.employee?.department?.name || '-'})
                              </span>
                            </div>
                            <span className="capitalize font-medium text-[#0284C7]">{part.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Belum ada pegawai yang didaftarkan ke program pelatihan ini.
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

      {/* Modal Tambah / Ubah Pelatihan */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingTraining ? 'Ubah Program Pelatihan' : 'Tambah Program Pelatihan'}
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
                  Judul Program Pelatihan
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Manajemen Beban Kerja & Kepatuhan K3"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    list="training-category-options"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Teknis & Rekayasa"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  />
                  <datalist id="training-category-options">
                    {categorySuggestions.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durasi (Jam)
                  </label>
                  <input
                    type="number"
                    required
                    min="0.5"
                    max="1000"
                    step="0.5"
                    value={form.duration_hours}
                    onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Penyelenggara / Provider
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="Contoh: WorkBalance Tech Academy"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
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
                    : editingTraining
                      ? 'Simpan Perubahan'
                      : 'Simpan Pelatihan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pelatihan */}
      {deletingTraining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Program Pelatihan?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Program pelatihan <span className="font-semibold text-[#1E293B]">{deletingTraining.title}</span> akan dihapus dari katalog.
              {Number(deletingTraining.participations_count || 0) > 0 && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Program ini masih memiliki {deletingTraining.participations_count} peserta terdaftar. Penghapusan akan ditolak sistem untuk menjaga integritas data (`restrictOnDelete`).
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingTraining(null)}
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
