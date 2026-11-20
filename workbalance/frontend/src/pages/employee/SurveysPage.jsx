import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  HeartHandshake,
  Lock,
  MessageSquareHeart,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../services/api';
import { surveyService } from '../../services/surveyService';

const ACTIVE_PILLS = [
  { value: '', label: 'Semua' },
  { value: '1', label: 'Dibuka' },
  { value: '0', label: 'Ditutup' },
];

const WLB_LIKERT_LABELS = {
  1: '1 — Sangat Buruk',
  2: '2 — Kurang Baik',
  3: '3 — Cukup',
  4: '4 — Baik',
  5: '5 — Sangat Seimbang',
};

const WORKLOAD_LIKERT_LABELS = {
  1: '1 — Sangat Ringan',
  2: '2 — Terkendali',
  3: '3 — Sedang',
  4: '4 — Cukup Berat',
  5: '5 — Sangat Berat',
};

function getDimensionBadge(score) {
  if (score === null || score === undefined) {
    return { label: 'Belum ada data', badgeClass: 'bg-slate-100 text-slate-600' };
  }
  const num = Number(score);
  if (num >= 75) {
    return { label: `${num.toFixed(1)} (Baik)`, badgeClass: 'bg-[#D1FAE5] text-[#047857]' };
  }
  if (num >= 50) {
    return { label: `${num.toFixed(1)} (Perlu Perhatian)`, badgeClass: 'bg-[#FEF3C7] text-[#B45309]' };
  }
  return { label: `${num.toFixed(1)} (Prioritas)`, badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]' };
}

function emptySurveyForm() {
  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    title: '',
    period_month: periodMonth,
    description: '',
    is_active: true,
  };
}

function emptyResponseForm() {
  return {
    work_life_balance_score: 4,
    workload_perception_score: 3,
    comments: '',
  };
}

export default function SurveysPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [surveys, setSurveys] = useState([]);
  const [summary, setSummary] = useState({});

  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Aggregate Detail Modal (Manager / Admin)
  const [aggregateModalOpen, setAggregateModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  // Create / Edit Survey Questionnaire Modal (Manager / Admin)
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [surveyForm, setSurveyForm] = useState(emptySurveyForm());
  const [surveyFormError, setSurveyFormError] = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);

  // Delete Survey Modal
  const [deletingSurvey, setDeletingSurvey] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Employee Survey Response Modal
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [respondingSurvey, setRespondingSurvey] = useState(null);
  const [responseForm, setResponseForm] = useState(emptyResponseForm());
  const [responseFormError, setResponseFormError] = useState('');
  const [responseSubmitting, setResponseSubmitting] = useState(false);

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
      const data = await surveyService.getSurveys({
        search: search.trim(),
        is_active: activeFilter,
      });

      setSurveys(data?.surveys || []);
      setSummary(data?.summary || {});
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data survei kondisi kerja.').message);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || activeFilter !== ''),
    [search, activeFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setActiveFilter('');
  };

  // --- Questionnaire CRUD (Admin & Manager) ---
  const openCreateSurveyModal = () => {
    setEditingSurvey(null);
    setSurveyForm(emptySurveyForm());
    setSurveyFormError('');
    setSurveyModalOpen(true);
  };

  const openEditSurveyModal = (survey) => {
    setEditingSurvey(survey);
    setSurveyForm({
      title: survey.title || '',
      period_month: survey.period_month || '',
      description: survey.description || '',
      is_active: Boolean(survey.is_active),
    });
    setSurveyFormError('');
    setSurveyModalOpen(true);
  };

  const handleSurveySubmit = async (e) => {
    e.preventDefault();
    setSurveySubmitting(true);
    setSurveyFormError('');

    const payload = {
      title: surveyForm.title.trim(),
      period_month: surveyForm.period_month.trim(),
      description: surveyForm.description.trim() || null,
      is_active: Boolean(surveyForm.is_active),
    };

    try {
      if (editingSurvey) {
        const res = await surveyService.updateSurvey(editingSurvey.id, payload);
        showToast('success', res.message || 'Survei kondisi kerja berhasil diperbarui.');
      } else {
        const res = await surveyService.createSurvey(payload);
        showToast('success', res.message || 'Periode survei kondisi kerja berhasil dibuat.');
      }
      setSurveyModalOpen(false);
      await loadAllData();
    } catch (err) {
      setSurveyFormError(extractApiError(err, 'Gagal menyimpan survei kondisi kerja.').message);
    } finally {
      setSurveySubmitting(false);
    }
  };

  const handleConfirmDeleteSurvey = async () => {
    if (!deletingSurvey) return;
    setDeleteLoading(true);

    try {
      const res = await surveyService.deleteSurvey(deletingSurvey.id);
      showToast('success', res.message || 'Survei kondisi kerja berhasil dihapus.');
      setDeletingSurvey(null);
      await loadAllData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Survei tidak dapat dihapus.').message);
      setDeletingSurvey(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- Employee Response Handlers ---
  const openResponseModal = (survey) => {
    setRespondingSurvey(survey);
    if (survey.my_response) {
      setResponseForm({
        work_life_balance_score: Number(survey.my_response.work_life_balance_score || 4),
        workload_perception_score: Number(survey.my_response.workload_perception_score || 3),
        comments: survey.my_response.comments || '',
      });
    } else {
      setResponseForm(emptyResponseForm());
    }
    setResponseFormError('');
    setResponseModalOpen(true);
  };

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!respondingSurvey) return;

    setResponseSubmitting(true);
    setResponseFormError('');

    const payload = {
      work_life_balance_score: Number(responseForm.work_life_balance_score),
      workload_perception_score: Number(responseForm.workload_perception_score),
      comments: responseForm.comments.trim() || null,
    };

    try {
      if (respondingSurvey.my_response) {
        const res = await surveyService.updateResponse(respondingSurvey.id, payload);
        showToast('success', res.message || 'Respons survei Anda berhasil diperbarui.');
      } else {
        const res = await surveyService.submitResponse(respondingSurvey.id, payload);
        showToast('success', res.message || 'Respons survei Anda berhasil dikirim.');
      }
      setResponseModalOpen(false);
      await loadAllData();
    } catch (err) {
      setResponseFormError(extractApiError(err, 'Gagal mengirim respons survei.').message);
    } finally {
      setResponseSubmitting(false);
    }
  };

  const kpiCards = isEmployee
    ? [
        {
          label: 'Survei Periode Dibuka',
          value: summary.active_surveys_count ?? 0,
          badge: `Dari ${summary.total_surveys ?? 0} total periode`,
          badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
          icon: HeartHandshake,
          iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
        },
        {
          label: 'Survei Sudah Diisi',
          value: summary.my_submitted_count ?? 0,
          badge: 'Terima kasih atas partisipasi Anda',
          badgeClass: 'bg-[#D1FAE5] text-[#047857]',
          icon: CheckCircle2,
          iconBg: 'bg-[#D1FAE5] text-[#10B981]',
        },
        {
          label: 'Menunggu Pengisian',
          value: summary.my_pending_count ?? 0,
          badge:
            Number(summary.my_pending_count || 0) > 0
              ? 'Mohon lengkapi survei aktif'
              : 'Semua survei aktif terisi',
          badgeClass:
            Number(summary.my_pending_count || 0) > 0
              ? 'bg-[#FEF3C7] text-[#B45309]'
              : 'bg-[#D1FAE5] text-[#047857]',
          icon: ClipboardCheck,
          iconBg:
            Number(summary.my_pending_count || 0) > 0
              ? 'bg-[#FEF3C7] text-[#F59E0B]'
              : 'bg-[#D1FAE5] text-[#10B981]',
        },
        {
          label: 'Rata-rata Skor WLB Saya',
          value:
            summary.my_avg_wlb !== null && summary.my_avg_wlb !== undefined
              ? `${Number(summary.my_avg_wlb).toFixed(1)} / 5`
              : '-',
          badge: 'Skala Likert 1–5 pribadi',
          badgeClass: 'bg-slate-100 text-slate-600',
          icon: MessageSquareHeart,
          iconBg: 'bg-slate-100 text-[#1E293B]',
        },
      ]
    : [
        {
          label: 'Total Periode Survei',
          value: summary.total_surveys ?? 0,
          badge: `${summary.active_surveys_count ?? 0} periode dibuka`,
          badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
          icon: HeartHandshake,
          iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
        },
        {
          label: 'Rata-rata Skor WLB (Agregat)',
          value:
            summary.overall_avg_wlb !== null && summary.overall_avg_wlb !== undefined
              ? `${Number(summary.overall_avg_wlb).toFixed(2)} / 5`
              : '-',
          badge: `Dimensi WLB: ${summary.overall_wlb_dimension_score ?? 0} / 100`,
          badgeClass: 'bg-[#D1FAE5] text-[#047857]',
          icon: BarChart3,
          iconBg: 'bg-[#D1FAE5] text-[#10B981]',
        },
        {
          label: 'Persepsi Beban Kerja',
          value:
            summary.overall_avg_workload_perception !== null &&
            summary.overall_avg_workload_perception !== undefined
              ? `${Number(summary.overall_avg_workload_perception).toFixed(2)} / 5`
              : '-',
          badge: 'Rata-rata agregat persepsi tim',
          badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
          icon: MessageSquareHeart,
          iconBg: 'bg-[#FEF3C7] text-[#F59E0B]',
        },
        {
          label: 'Tingkat Partisipasi',
          value: `${Number(summary.overall_participation_rate || 0).toFixed(1)}%`,
          badge: `${summary.total_responses ?? 0} respons agregat`,
          badgeClass: 'bg-slate-100 text-slate-600',
          icon: Users,
          iconBg: 'bg-slate-100 text-[#1E293B]',
        },
      ];

  return (
    <AppShell
      title="Survei Kondisi Kerja"
      breadcrumb={
        isEmployee
          ? 'Kesejahteraan / Pengisian Survei Kondisi Kerja'
          : 'Kesejahteraan / Survei & Agregasi Departemen / PBI-07'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari judul survei atau periode (YYYY-MM)..."
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

        {/* NFR-02 Privacy Callout */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs text-[#0369A1]">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
          <p className="leading-relaxed">
            <span className="font-semibold">Jaminan Privasi Survei (NFR-02):</span>{' '}
            {isEmployee
              ? 'Jawaban dan komentar Anda bersifat rahasia. Manajer hanya melihat skor rata-rata dan tingkat partisipasi secara agregat per departemen.'
              : 'Identitas responden maupun komentar individu tidak pernah ditampilkan pada antarmuka manajemen. Seluruh hasil survei disajikan dalam bentuk metrik agregat departemen.'}
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
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Survei</h2>
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

        {/* Surveys Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#1E293B]">
                  Daftar Periode Survei Kondisi Kerja
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {surveys.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari survei / YYYY-MM..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                {/* Status Filter Pills */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {ACTIVE_PILLS.map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setActiveFilter(pill.value)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        activeFilter === pill.value
                          ? 'bg-white text-[#1E293B] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={openCreateSurveyModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Survei Baru</span>
                  </button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : surveys.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto mb-3">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B]">
                  {hasActiveFilters
                    ? 'Tidak ada survei yang sesuai filter'
                    : 'Belum ada periode survei kondisi kerja'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Coba ubah kata kunci pencarian atau setel ulang filter.'
                    : canManage
                      ? 'Buat periode survei baru untuk mulai mengumpulkan umpan balik keseimbangan kerja pegawai.'
                      : 'Belum ada kuesioner survei yang dibuka untuk periode ini.'}
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
                  {canManage && (
                    <button
                      type="button"
                      onClick={openCreateSurveyModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Buat Survei Baru</span>
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
                      <th className="py-3 px-4 font-semibold">Judul & Deskripsi Survei</th>
                      <th className="py-3 px-4 font-semibold">Periode</th>
                      <th className="py-3 px-4 font-semibold">Status Periode</th>
                      {isEmployee ? (
                        <>
                          <th className="py-3 px-4 font-semibold">Partisipasi Saya</th>
                          <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-4 font-semibold">Responden</th>
                          <th className="py-3 px-4 font-semibold">Skor WLB (Dimensi 2)</th>
                          <th className="py-3 px-4 font-semibold">Persepsi Beban</th>
                          <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {surveys.map((survey) => {
                      const dimBadge = getDimensionBadge(survey.converted_wlb_dimension_score);
                      const hasResponses = Number(survey.responses_count || 0) > 0;

                      return (
                        <tr
                          key={survey.id}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 max-w-md">
                            <p className="font-semibold text-[#1E293B]">{survey.title}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {survey.description || 'Survei berkala keseimbangan kehidupan kerja'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 tabular-nums font-semibold text-[#1E293B] whitespace-nowrap">
                            {survey.period_month}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {survey.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">
                                Dibuka
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Ditutup
                              </span>
                            )}
                          </td>

                          {isEmployee ? (
                            <>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {survey.my_response ? (
                                  <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">
                                      Sudah Diisi
                                    </span>
                                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                                      WLB: {survey.my_response.work_life_balance_score}/5 • Beban:{' '}
                                      {survey.my_response.workload_perception_score}/5
                                    </p>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#B45309]">
                                    Belum Diisi
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                {survey.is_active ? (
                                  <button
                                    type="button"
                                    onClick={() => openResponseModal(survey)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>{survey.my_response ? 'Ubah Jawaban' : 'Isi Survei'}</span>
                                  </button>
                                ) : survey.my_response ? (
                                  <span className="text-xs text-slate-400 font-medium">
                                    Terkirim
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Periode ditutup</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                                <span className="font-semibold text-[#1E293B]">
                                  {survey.responses_count}
                                </span>{' '}
                                <span className="text-xs text-slate-500">
                                  ({Number(survey.participation_rate || 0).toFixed(1)}%)
                                </span>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-xs font-semibold text-[#1E293B] tabular-nums">
                                    {survey.avg_wlb_score !== null
                                      ? `${Number(survey.avg_wlb_score).toFixed(2)} / 5`
                                      : '-'}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${dimBadge.badgeClass}`}
                                  >
                                    {dimBadge.label}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 tabular-nums whitespace-nowrap font-medium text-[#1E293B]">
                                {survey.avg_workload_perception_score !== null
                                  ? `${Number(survey.avg_workload_perception_score).toFixed(2)} / 5`
                                  : '-'}
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSurvey(survey);
                                      setAggregateModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                    title="Lihat Agregat per Departemen"
                                  >
                                    <BarChart3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditSurveyModal(survey)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0284C7] hover:bg-[#E0F2FE]/60 transition cursor-pointer"
                                    title="Ubah Survei"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingSurvey(survey)}
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                      hasResponses
                                        ? 'text-slate-400 hover:text-[#B45309] hover:bg-[#FEF3C7]/70'
                                        : 'text-slate-500 hover:text-[#EF4444] hover:bg-[#FEE2E2]/70'
                                    }`}
                                    title={
                                      hasResponses
                                        ? 'Sudah memiliki respons (penghapusan ditolak sistem)'
                                        : 'Hapus Survei'
                                    }
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
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

      {/* Modal Agregat Departemen (Manager & Admin — NFR-02 Strict Aggregation) */}
      {aggregateModalOpen && selectedSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  Hasil Agregat Departemen — {selectedSurvey.period_month}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedSurvey.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setAggregateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#0369A1] bg-[#E0F2FE] px-3.5 py-2.5 rounded-lg">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  Privasi NFR-02: Hanya menampilkan statistik agregat (`AVG` & `COUNT`) per departemen tanpa identitas atau komentar individu.
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[#64748B] text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5 font-semibold">Departemen</th>
                      <th className="py-2.5 px-3.5 font-semibold">Partisipasi</th>
                      <th className="py-2.5 px-3.5 font-semibold">Rata-rata WLB</th>
                      <th className="py-2.5 px-3.5 font-semibold">Dimensi WLB (0–100)</th>
                      <th className="py-2.5 px-3.5 font-semibold">Persepsi Beban</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-[#334155]">
                    {(selectedSurvey.department_aggregates || []).map((dept) => {
                      const deptDimBadge = getDimensionBadge(dept.converted_wlb_dimension_score);
                      return (
                        <tr key={dept.department_id} className="border-b border-slate-100 last:border-none">
                          <td className="py-3 px-3.5">
                            <span className="font-semibold text-[#1E293B]">
                              {dept.department_name}
                            </span>
                            <span className="ml-1.5 text-xs text-slate-500">
                              ({dept.department_code})
                            </span>
                          </td>
                          <td className="py-3 px-3.5 tabular-nums text-xs">
                            <span className="font-semibold text-[#1E293B]">
                              {dept.respondents_count} / {dept.active_employees_count}
                            </span>{' '}
                            ({Number(dept.participation_rate || 0).toFixed(1)}%)
                          </td>
                          <td className="py-3 px-3.5 tabular-nums font-medium">
                            {dept.avg_wlb_score !== null
                              ? `${Number(dept.avg_wlb_score).toFixed(2)} / 5`
                              : '-'}
                          </td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${deptDimBadge.badgeClass}`}
                            >
                              {deptDimBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 tabular-nums font-medium">
                            {dept.avg_workload_perception_score !== null
                              ? `${Number(dept.avg_workload_perception_score).toFixed(2)} / 5`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAggregateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buat / Ubah Survei (Manager & Admin) */}
      {surveyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1E293B]">
                {editingSurvey ? 'Ubah Periode Survei' : 'Buat Survei Kondisi Kerja Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setSurveyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSurveySubmit} className="p-6 space-y-4">
              {surveyFormError && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{surveyFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Survei
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm({ ...surveyForm, title: e.target.value })}
                  placeholder="Contoh: Survei Kondisi Kerja Desember 2026"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periode Bulan (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    required
                    value={surveyForm.period_month}
                    onChange={(e) => setSurveyForm({ ...surveyForm, period_month: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Pengisian
                  </label>
                  <select
                    value={surveyForm.is_active ? '1' : '0'}
                    onChange={(e) =>
                      setSurveyForm({ ...surveyForm, is_active: e.target.value === '1' })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="1">Dibuka (Aktif)</option>
                    <option value="0">Ditutup</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi / Tujuan Survei (Opsional)
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={surveyForm.description}
                  onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
                  placeholder="Penjelasan singkat mengenai tujuan pengisian survei periode ini..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSurveyModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={surveySubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition cursor-pointer"
                >
                  {surveySubmitting ? 'Menyimpan...' : editingSurvey ? 'Simpan Perubahan' : 'Buat Survei'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Survei */}
      {deletingSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-[#1E293B]">Hapus Periode Survei?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Survei <span className="font-semibold text-[#1E293B]">{deletingSurvey.title}</span>{' '}
              ({deletingSurvey.period_month}) akan dihapus.
              {Number(deletingSurvey.responses_count || 0) > 0 && (
                <span className="block mt-2 text-xs text-[#B45309] bg-[#FEF3C7] p-2.5 rounded-lg">
                  Perhatian: Survei ini sudah memiliki {deletingSurvey.responses_count} respons pegawai. Penghapusan akan ditolak oleh sistem.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSurvey(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteSurvey}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#EF4444] hover:bg-red-600 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {deleteLoading ? 'Memproses...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengisian Survei Kondisi Kerja (Employee Likert 1-5) */}
      {responseModalOpen && respondingSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  {respondingSurvey.my_response ? 'Perbarui Jawaban Survei' : 'Isi Survei Kondisi Kerja'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {respondingSurvey.title} ({respondingSurvey.period_month})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResponseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResponseSubmit} className="p-6 space-y-5">
              {responseFormError && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{responseFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-2">
                  1. Keseimbangan Kehidupan & Pekerjaan (Work-Life Balance)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((score) => {
                    const selected = Number(responseForm.work_life_balance_score) === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() =>
                          setResponseForm({ ...responseForm, work_life_balance_score: score })
                        }
                        className={`py-2.5 rounded-lg border text-sm font-bold tabular-nums transition cursor-pointer ${
                          selected
                            ? 'bg-[#0284C7] border-[#0284C7] text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#0284C7]'
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#0284C7] font-medium mt-1.5">
                  {WLB_LIKERT_LABELS[responseForm.work_life_balance_score]}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-2">
                  2. Persepsi Beban Kerja Saat Ini (Workload Perception)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((score) => {
                    const selected = Number(responseForm.workload_perception_score) === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() =>
                          setResponseForm({ ...responseForm, workload_perception_score: score })
                        }
                        className={`py-2.5 rounded-lg border text-sm font-bold tabular-nums transition cursor-pointer ${
                          selected
                            ? 'bg-[#10B981] border-[#10B981] text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#10B981]'
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#047857] font-medium mt-1.5">
                  {WORKLOAD_LIKERT_LABELS[responseForm.workload_perception_score]}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan atau Masukan Tambahan (Opsional & Rahasia)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={responseForm.comments}
                  onChange={(e) => setResponseForm({ ...responseForm, comments: e.target.value })}
                  placeholder="Bagikan pengalaman kerja, masukan distribusi tugas, atau kendala waktu istirahat..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResponseModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={responseSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition cursor-pointer"
                >
                  {responseSubmitting
                    ? 'Mengirim...'
                    : respondingSurvey.my_response
                      ? 'Perbarui Jawaban'
                      : 'Kirim Jawaban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
