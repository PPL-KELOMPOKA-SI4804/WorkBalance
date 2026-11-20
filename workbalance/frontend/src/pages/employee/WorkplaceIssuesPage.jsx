import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Lock,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../services/api';
import { workplaceIssueService } from '../../services/workplaceIssueService';

const STATUS_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'open', label: 'Menunggu' },
  { value: 'in_progress', label: 'Ditangani' },
  { value: 'resolved', label: 'Selesai' },
];

const ISSUE_STATUS_STYLES = {
  open: {
    label: 'Menunggu',
    badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
    detailText: 'Menunggu peninjauan oleh manajer atau HR',
  },
  in_progress: {
    label: 'Ditangani',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    detailText: 'Sedang dalam proses tindak lanjut tim terkait',
  },
  resolved: {
    label: 'Selesai',
    badgeClass: 'bg-[#D1FAE5] text-[#047857]',
    detailText: 'Permasalahan telah ditindaklanjuti dan selesai',
  },
};

const PRESET_CATEGORIES = [
  'Beban Kerja',
  'Jadwal & Lembur',
  'Fasilitas & Ergonomi',
  'Komunikasi Tim',
  'Kenyamanan & K3',
  'Lainnya',
];

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function emptyIssueForm(defaultDepartmentId = '') {
  return {
    category: PRESET_CATEGORIES[0],
    department_id: defaultDepartmentId ? String(defaultDepartmentId) : '',
    description: '',
  };
}

export default function WorkplaceIssuesPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const canHandle = user?.role === 'admin' || user?.role === 'manager';
  const defaultDepartmentId = user?.employee?.department_id || '';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [issues, setIssues] = useState([]);
  const [apiCategories, setApiCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    resolution_rate: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit Issue Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [issueForm, setIssueForm] = useState(() => emptyIssueForm(defaultDepartmentId));
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Follow-up Modal (Manager & Admin)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpIssue, setFollowUpIssue] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({ status: 'in_progress', resolution_notes: '' });
  const [followUpError, setFollowUpError] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // Delete Modal
  const [deletingIssue, setDeletingIssue] = useState(null);
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
      const data = await workplaceIssueService.getIssues({
        search: search.trim(),
        status: statusFilter,
        category: categoryFilter,
        department_id: departmentFilter,
      });

      setIssues(data?.issues || []);
      setApiCategories(data?.categories || []);
      setDepartments(data?.departments || []);
      setSummary(
        data?.summary || {
          total: 0,
          open: 0,
          in_progress: 0,
          resolved: 0,
          resolution_rate: 0,
        }
      );
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat daftar laporan permasalahan kerja.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, departmentFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...PRESET_CATEGORIES, ...apiCategories])),
    [apiCategories]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || categoryFilter || departmentFilter),
    [search, statusFilter, categoryFilter, departmentFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
  };

  // --- Detail Handler ---
  const openDetailModal = async (issue) => {
    setDetailIssue(issue);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workplaceIssueService.getIssue(issue.id);
      setDetailIssue(fresh);
    } catch {
      // Fall back silently to list row snapshot if detail refresh fails
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create / Edit Issue Handlers ---
  const openCreateModal = () => {
    setEditingIssue(null);
    const initialDept = defaultDepartmentId || departments[0]?.id || '';
    setIssueForm(emptyIssueForm(initialDept));
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (issue) => {
    setEditingIssue(issue);
    setIssueForm({
      category: issue.category || PRESET_CATEGORIES[0],
      department_id: issue.department_id ? String(issue.department_id) : '',
      description: issue.description || '',
    });
    setFormError('');
    setFormModalOpen(true);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedDesc = issueForm.description.trim();
    if (!issueForm.category.trim()) {
      setFormError('Kategori permasalahan wajib dipilih.');
      return;
    }
    if (trimmedDesc.length < 10) {
      setFormError('Deskripsi permasalahan minimal 10 karakter agar mudah ditindaklanjuti.');
      return;
    }

    setFormSubmitting(true);
    const payload = {
      category: issueForm.category.trim(),
      description: trimmedDesc,
      ...(issueForm.department_id ? { department_id: Number(issueForm.department_id) } : {}),
    };

    try {
      if (editingIssue) {
        const res = await workplaceIssueService.updateIssue(editingIssue.id, payload);
        showToast('success', res.message || 'Laporan permasalahan kerja berhasil diperbarui.');
      } else {
        const res = await workplaceIssueService.createIssue(payload);
        showToast('success', res.message || 'Laporan permasalahan kerja berhasil dikirim.');
      }
      setFormModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan laporan permasalahan kerja.').message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- Follow-up Handlers (Manager & Admin) ---
  const openFollowUpModal = (issue) => {
    setFollowUpIssue(issue);
    setFollowUpForm({
      status: issue.status || 'open',
      resolution_notes: issue.resolution_notes || '',
    });
    setFollowUpError('');
    setFollowUpModalOpen(true);
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUpIssue) return;

    setFollowUpError('');
    const trimmedNotes = followUpForm.resolution_notes.trim();

    if (followUpForm.status === 'resolved' && trimmedNotes.length < 5) {
      setFollowUpError('Mohon isi catatan penyelesaian minimal 5 karakter sebelum menandai laporan selesai.');
      return;
    }

    setFollowUpSubmitting(true);
    try {
      const res = await workplaceIssueService.updateIssue(followUpIssue.id, {
        status: followUpForm.status,
        resolution_notes: trimmedNotes || null,
      });
      showToast('success', res.message || 'Status tindak lanjut laporan berhasil diperbarui.');
      setFollowUpModalOpen(false);
      await loadAllData();
    } catch (err) {
      setFollowUpError(extractApiError(err, 'Gagal memperbarui status penanganan laporan.').message);
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingIssue) return;
    setDeleteLoading(true);
    try {
      const res = await workplaceIssueService.deleteIssue(deletingIssue.id);
      showToast('success', res.message || 'Laporan permasalahan kerja berhasil dihapus.');
      setDeletingIssue(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Laporan tidak dapat dihapus.').message);
      setDeletingIssue(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const kpiCards = [
    {
      label: isEmployee ? 'Total Laporan Saya' : 'Total Laporan Masuk',
      value: summary.total ?? 0,
      badge: isEmployee ? 'Aspirasi & kendala pribadi' : 'Seluruh departemen',
      badgeClass: 'bg-slate-100 text-slate-600',
      icon: MessageSquareWarning,
      iconBg: 'bg-slate-100 text-[#1E293B]',
    },
    {
      label: 'Menunggu Penanganan',
      value: summary.open ?? 0,
      badge: 'Status: Menunggu (Open)',
      badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
      icon: Clock,
      iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'Sedang Ditangani',
      value: summary.in_progress ?? 0,
      badge: 'Status: Ditangani (In Progress)',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
      icon: Wrench,
      iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
    },
    {
      label: 'Selesai Ditangani',
      value: summary.resolved ?? 0,
      badge: `Rasio Penyelesaian: ${Number(summary.resolution_rate || 0).toFixed(1)}%`,
      badgeClass: 'bg-[#D1FAE5] text-[#047857]',
      icon: CheckCircle2,
      iconBg: 'bg-[#D1FAE5] text-[#10B981]',
    },
  ];

  return (
    <AppShell
      title="Pelaporan Permasalahan Kerja"
      breadcrumb={
        isEmployee
          ? 'Suara Pekerja / Laporan & Pemantauan Kendala Kerja'
          : 'Suara Pekerja / Penanganan & Resolusi Kendala Kerja / PBI-08'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari kategori, deskripsi, atau pelapor..."
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

        {/* Non-punitive / Governance Callout */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs text-[#0369A1]">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
          <p className="leading-relaxed">
            <span className="font-semibold">Saluran Suara Pekerja & Jejak Audit:</span>{' '}
            {isEmployee
              ? 'Sampaikan kendala beban kerja, jadwal, fasilitas, atau komunikasi tim secara terbuka dan konstruktif. Laporan berstatus Menunggu masih dapat Anda ubah atau batalkan; laporan yang sudah diproses terkunci sebagai jejak audit penanganan.'
              : 'Tindak lanjuti setiap kendala kerja secara konstruktif dan transparan. Rasio penyelesaian laporan berkontribusi langsung pada sub-indikator Dimensi 5 (Suara Pekerja) dalam Decent Work Score.'}
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
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Laporan Permasalahan</h2>
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

        {/* Issues Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">
                  {isEmployee ? 'Daftar Laporan Saya' : 'Daftar Laporan Permasalahan Kerja'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {issues.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari kendala / pelapor..."
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

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  aria-label="Filter kategori permasalahan"
                >
                  <option value="">Semua Kategori</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

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

                <button
                  type="button"
                  onClick={loadAllData}
                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
                  title="Muat ulang daftar"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Laporan Baru</span>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : issues.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <MessageSquareWarning className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B] mt-3">
                  {hasActiveFilters
                    ? 'Tidak Ada Laporan Sesuai Filter'
                    : 'Belum Ada Laporan Permasalahan'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Tidak ditemukan laporan yang sesuai dengan kata kunci atau filter yang dipilih.'
                    : isEmployee
                      ? 'Anda belum mengirimkan laporan permasalahan tempat kerja. Gunakan tombol di bawah jika ada kendala yang perlu ditindaklanjuti.'
                      : 'Belum ada laporan permasalahan kerja yang tercatat pada sistem.'}
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
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Laporan Baru</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Responsive Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Kategori & Deskripsi</th>
                      {canHandle && <th className="py-3 px-4">Pelapor</th>}
                      <th className="py-3 px-4">Departemen</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Catatan Tindak Lanjut</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {issues.map((issue) => {
                      const statusMeta = ISSUE_STATUS_STYLES[issue.status] || ISSUE_STATUS_STYLES.open;
                      const isOpen = issue.status === 'open';
                      return (
                        <tr key={issue.id} className="hover:bg-slate-50/70 transition align-top">
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                                {issue.category}
                              </span>
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                {formatDateTime(issue.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1.5 line-clamp-2 leading-relaxed">
                              {issue.description}
                            </p>
                          </td>

                          {canHandle && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="font-medium text-[#1E293B] text-xs">
                                {issue.reporter?.full_name || '-'}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono">{issue.reporter?.employee_code || '-'}</span>
                                {issue.reporter?.position?.title
                                  ? ` · ${issue.reporter.position.title}`
                                  : ''}
                              </p>
                            </td>
                          )}

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {issue.department ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                                  {issue.department.code}
                                </span>
                                <p className="text-xs text-slate-600 mt-1">{issue.department.name}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                            {issue.resolved_at && (
                              <p className="text-[11px] text-[#047857] mt-1 tabular-nums">
                                Selesai: {formatDateTime(issue.resolved_at)}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            {issue.resolution_notes ? (
                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {issue.resolution_notes}
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Belum ada catatan tindak lanjut
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDetailModal(issue)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                title="Lihat detail laporan"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detail</span>
                              </button>

                              {canHandle && (
                                <button
                                  type="button"
                                  onClick={() => openFollowUpModal(issue)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                                  title="Tindak lanjuti & perbarui status"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>Tindak Lanjut</span>
                                </button>
                              )}

                              {isEmployee && isOpen && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(issue)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-[#E0F2FE]/60 text-[#0369A1] hover:bg-[#E0F2FE] text-xs font-medium transition cursor-pointer"
                                  title="Edit laporan"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {isOpen ? (
                                <button
                                  type="button"
                                  onClick={() => setDeletingIssue(issue)}
                                  className="p-1.5 rounded-lg border border-red-200 text-[#EF4444] hover:bg-[#FEE2E2]/60 transition cursor-pointer"
                                  title="Hapus laporan menunggu"
                                  aria-label="Hapus laporan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span
                                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed inline-flex items-center"
                                  title="Laporan yang sedang ditangani atau selesai terkunci untuk menjaga jejak audit"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
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

      {/* Modal 1: Detail Laporan */}
      {detailModalOpen && detailIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  Detail Laporan Permasalahan Kerja
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID Laporan #{detailIssue.id} · Dikirim {formatDateTime(detailIssue.created_at)}
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

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {detailLoading && (
                <p className="text-xs text-slate-400">Menyegarkan detail laporan...</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Kategori</p>
                  <p className="text-sm font-semibold text-[#1E293B] mt-1">
                    {detailIssue.category}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Status Penanganan</p>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (ISSUE_STATUS_STYLES[detailIssue.status] || ISSUE_STATUS_STYLES.open)
                          .badgeClass
                      }`}
                    >
                      {(ISSUE_STATUS_STYLES[detailIssue.status] || ISSUE_STATUS_STYLES.open).label}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Pelapor</p>
                  <p className="text-sm font-semibold text-[#1E293B] mt-1">
                    {detailIssue.reporter?.full_name || '-'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {detailIssue.reporter?.employee_code || ''}
                    {detailIssue.reporter?.position?.title
                      ? ` · ${detailIssue.reporter.position.title}`
                      : ''}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 font-medium">Departemen Terkait</p>
                  <p className="text-sm font-semibold text-[#1E293B] mt-1">
                    {detailIssue.department
                      ? `${detailIssue.department.code} — ${detailIssue.department.name}`
                      : '-'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Deskripsi Permasalahan
                </p>
                <div className="mt-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {detailIssue.description}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Catatan & Tindak Lanjut Manajer / HR
                </p>
                <div
                  className={`mt-1.5 p-3.5 rounded-xl border text-sm leading-relaxed ${
                    detailIssue.resolution_notes
                      ? 'bg-[#D1FAE5]/30 border-emerald-200 text-slate-700'
                      : 'bg-slate-50 border-slate-200/70 text-slate-400 italic'
                  }`}
                >
                  {detailIssue.resolution_notes ||
                    'Belum ada catatan tindak lanjut dari manajer atau HR.'}
                </div>
                {detailIssue.resolved_at && (
                  <p className="text-xs text-[#047857] mt-1.5 font-medium tabular-nums">
                    Diselesaikan pada: {formatDateTime(detailIssue.resolved_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {canHandle && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openFollowUpModal(detailIssue);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Tindak Lanjut</span>
                </button>
              )}

              {isEmployee && detailIssue.status === 'open' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openEditModal(detailIssue);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Laporan</span>
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

      {/* Modal 2: Buat / Edit Laporan */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  {editingIssue ? 'Edit Laporan Permasalahan Kerja' : 'Buat Laporan Permasalahan Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sampaikan kendala secara jelas dan konstruktif untuk ditindaklanjuti.
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

            <form onSubmit={handleIssueSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEE2E2] text-[#B91C1C] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori Permasalahan <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={issueForm.category}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, category: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                >
                  {Array.from(
                    new Set([...PRESET_CATEGORIES, ...(issueForm.category ? [issueForm.category] : [])])
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Departemen Terkait
                </label>
                <select
                  value={issueForm.department_id}
                  onChange={(e) =>
                    setIssueForm((prev) => ({ ...prev, department_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="">Otomatis sesuai departemen saya</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={String(dept.id)}>
                      {dept.code} — {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deskripsi Permasalahan <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={issueForm.description}
                  onChange={(e) =>
                    setIssueForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Jelaskan situasi, dampak terhadap kenyamanan atau beban kerja, serta konteks lokasi/waktu bila relevan..."
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                  Minimal 10 karakter ({issueForm.description.trim().length} karakter tertulis).
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
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {formSubmitting
                    ? 'Menyimpan...'
                    : editingIssue
                      ? 'Simpan Perubahan'
                      : 'Kirim Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Tindak Lanjut Laporan (Manager & Admin) */}
      {followUpModalOpen && followUpIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  Tindak Lanjut Laporan Permasalahan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pelapor: {followUpIssue.reporter?.full_name || '-'} · Kategori:{' '}
                  {followUpIssue.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup tindak lanjut"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="p-6 space-y-4">
              {followUpError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEE2E2] text-[#B91C1C] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{followUpError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-1">Ringkasan Laporan:</p>
                <p>{followUpIssue.description}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Penanganan <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={followUpForm.status}
                  onChange={(e) =>
                    setFollowUpForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="open">Menunggu (Open)</option>
                  <option value="in_progress">Sedang Ditangani (In Progress)</option>
                  <option value="resolved">Selesai Ditangani (Resolved)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan Tindak Lanjut / Resolusi{' '}
                  {followUpForm.status === 'resolved' && <span className="text-[#EF4444]">*</span>}
                </label>
                <textarea
                  rows={4}
                  value={followUpForm.resolution_notes}
                  onChange={(e) =>
                    setFollowUpForm((prev) => ({ ...prev, resolution_notes: e.target.value }))
                  }
                  placeholder="Tuliskan langkah penanganan, penjadwalan ulang, atau solusi yang telah diterapkan..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFollowUpModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={followUpSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {followUpSubmitting ? 'Menyimpan...' : 'Simpan Tindak Lanjut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Konfirmasi Hapus */}
      {deletingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">Hapus Laporan Permasalahan?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Anda akan menghapus laporan kategori{' '}
                  <span className="font-semibold text-[#1E293B]">{deletingIssue.category}</span>{' '}
                  yang masih berstatus <span className="font-semibold">Menunggu</span>. Tindakan ini
                  tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingIssue(null)}
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
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
