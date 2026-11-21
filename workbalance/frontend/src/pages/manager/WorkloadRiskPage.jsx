import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../services/api';
import { workloadRiskService } from '../../services/workloadRiskService';

const RISK_FILTER_PILLS = [
  { value: '', label: 'Semua' },
  { value: 'high', label: 'Risiko Tinggi' },
  { value: 'medium', label: 'Sedang' },
  { value: 'low', label: 'Rendah' },
];

const RISK_STYLES = {
  low: {
    label: 'Risiko Rendah',
    shortLabel: 'Rendah',
    badgeClass: 'bg-[#D1FAE5] text-[#047857]',
    barClass: 'bg-[#10B981]',
    textClass: 'text-[#047857]',
  },
  medium: {
    label: 'Risiko Sedang',
    shortLabel: 'Sedang',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    barClass: 'bg-[#F59E0B]',
    textClass: 'text-[#B45309]',
  },
  high: {
    label: 'Risiko Tinggi',
    shortLabel: 'Tinggi',
    badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
    barClass: 'bg-[#EF4444]',
    textClass: 'text-[#B91C1C]',
  },
};

function getInitials(name) {
  const source = name || 'PG';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatNumber(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
}

function getScoreBarColor(score) {
  const num = Number(score || 0);
  if (num >= 70) return 'bg-[#EF4444]';
  if (num >= 40) return 'bg-[#F59E0B]';
  return 'bg-[#10B981]';
}

export default function WorkloadRiskPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const canRecalculate = user?.role === 'manager' || user?.role === 'admin';
  const routePrefix = user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/employee';

  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState({
    total_employees: 0,
    high_risk_count: 0,
    medium_risk_count: 0,
    low_risk_count: 0,
    overridden_count: 0,
    avg_final_score: 0,
    avg_weekly_hours_score: 0,
    avg_overtime_score: 0,
    avg_task_load_score: 0,
    avg_deadline_pressure_score: 0,
    total_weekly_hours: 0,
    total_active_estimated_hours: 0,
  });
  const [thresholds, setThresholds] = useState({});
  const [departments, setDepartments] = useState([]);
  const [filtersMeta, setFiltersMeta] = useState({});

  // Interactive Filters
  const [periodWeek, setPeriodWeek] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [riskCategory, setRiskCategory] = useState('');
  const [overrideOnly, setOverrideOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Diagnostic Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await workloadRiskService.getWorkloadRisks({
        period_week: periodWeek,
        department_id: departmentFilter,
        risk_category: riskCategory,
        is_overridden: overrideOnly ? '1' : '',
        search: search.trim(),
      });

      setRisks(data?.workload_risks || []);
      setSummary(data?.summary || {});
      setThresholds(data?.thresholds || {});
      setDepartments(data?.departments || []);
      setFiltersMeta(data?.filters || {});
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data analisis Workload Risk.').message);
    } finally {
      setLoading(false);
    }
  }, [periodWeek, departmentFilter, riskCategory, overrideOnly, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecalculate = async () => {
    if (!canRecalculate) return;
    setRecalculating(true);
    try {
      const res = await workloadRiskService.recalculateWorkloadRisks({
        period_week: periodWeek || filtersMeta.period_week || '',
        department_id: departmentFilter,
      });
      const count = res?.data?.recalculated_count ?? 0;
      showToast(
        'success',
        res?.message || `Kalkulasi ulang berhasil disimpan untuk ${count} pegawai aktif.`
      );
      await loadData();
    } catch (err) {
      showToast('error', extractApiError(err, 'Gagal menghitung ulang Workload Risk.').message);
    } finally {
      setRecalculating(false);
    }
  };

  const openDetailModal = async (row) => {
    setSelectedRisk(row);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workloadRiskService.getWorkloadRisk(row.id);
      setSelectedRisk(fresh);
    } catch {
      // Keep row snapshot if refresh fails
    } finally {
      setDetailLoading(false);
    }
  };

  const hasActiveFilters = useMemo(
    () => Boolean(periodWeek || departmentFilter || riskCategory || overrideOnly || search.trim()),
    [periodWeek, departmentFilter, riskCategory, overrideOnly, search]
  );

  const resetFilters = () => {
    setPeriodWeek('');
    setDepartmentFilter('');
    setRiskCategory('');
    setOverrideOnly(false);
    setSearch('');
  };

  const avgFinal = Number(summary.avg_final_score || 0);
  const avgCategoryMeta =
    (summary.overridden_count ?? 0) > 0 || avgFinal >= 70
      ? RISK_STYLES.high
      : avgFinal >= 40
        ? RISK_STYLES.medium
        : RISK_STYLES.low;

  const kpiCards = [
    {
      label: isEmployee ? 'Skor Workload Risk Saya' : 'Rata-rata Workload Risk Tim',
      value: formatNumber(avgFinal, 1),
      badge: `${avgCategoryMeta.label} (Skala 0–100)`,
      badgeClass: avgCategoryMeta.badgeClass,
      icon: Activity,
      iconBg: avgCategoryMeta.badgeClass,
    },
    {
      label: isEmployee ? 'Status Kategori Risiko' : 'Pegawai Risiko Tinggi',
      value: isEmployee
        ? (RISK_STYLES[risks[0]?.risk_category]?.shortLabel || avgCategoryMeta.shortLabel)
        : (summary.high_risk_count ?? 0),
      badge: isEmployee
        ? `Periode ${filtersMeta.period_week || '-'}`
        : `Dari ${summary.total_employees ?? 0} pegawai aktif`,
      badgeClass:
        (summary.high_risk_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#B91C1C]'
          : 'bg-[#D1FAE5] text-[#047857]',
      icon: ShieldAlert,
      iconBg:
        (summary.high_risk_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#EF4444]'
          : 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Override Wajib PP No. 35/2021',
      value: summary.overridden_count ?? 0,
      badge: 'Jam ≥ 55j/mg atau lembur > 4j/hr / > 18j/mg',
      badgeClass:
        (summary.overridden_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#B91C1C]'
          : 'bg-[#E0F2FE] text-[#0369A1]',
      icon: AlertTriangle,
      iconBg:
        (summary.overridden_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#EF4444]'
          : 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: isEmployee ? 'Jam Aktual vs Estimasi Aktif' : 'Distribusi Sedang & Rendah',
      value: isEmployee
        ? `${formatNumber(summary.total_weekly_hours, 1)}j / ${formatNumber(
            summary.total_active_estimated_hours,
            0
          )}j`
        : `${summary.medium_risk_count ?? 0} / ${summary.low_risk_count ?? 0}`,
      badge: isEmployee ? 'Jam log minggu ini / estimasi tugas' : 'Sedang (40–69) · Rendah (< 40)',
      badgeClass: 'bg-slate-100 text-slate-700',
      icon: Users,
      iconBg: 'bg-slate-100 text-[#1E293B]',
    },
  ];

  const subIndicatorBars = [
    {
      key: 'weekly_hours',
      label: '1. Waktu Kerja Mingguan',
      score: summary.avg_weekly_hours_score,
      hint: `Interpolasi ${thresholds.normal_weekly_hours_threshold ?? 40}j (0) s.d. ${
        thresholds.critical_weekly_hours_threshold ?? 55
      }j (100)`,
    },
    {
      key: 'overtime',
      label: '2. Lembur',
      score: summary.avg_overtime_score,
      hint: `Adaptif 8j (5hk) / 7j (6hk); > ${thresholds.max_daily_overtime_hours ?? 4}j/hr atau > ${
        thresholds.max_weekly_overtime_hours ?? 18
      }j/mg -> 100`,
    },
    {
      key: 'task_load',
      label: '3. Beban Tugas vs Kapasitas Efektif',
      score: summary.avg_task_load_score,
      hint: `Rasio estimasi terhadap kapasitas (40j − cuti): ${thresholds.task_load_safe_ratio ?? 1.0} (0) s.d. ${
        thresholds.task_load_max_ratio ?? 1.5
      } (100)`,
    },
    {
      key: 'deadline_pressure',
      label: '4. Tekanan Tenggat',
      score: summary.avg_deadline_pressure_score,
      hint: `Persentase penugasan aktif jatuh tempo ≤ ${thresholds.deadline_window_days ?? 7} hari atau overdue`,
    },
  ];

  return (
    <AppShell
      title="Identifikasi & Analisis Workload Risk"
      breadcrumb={
        isEmployee
          ? 'Analitik / Profil Risiko Beban Kerja Pribadi (PBI-11)'
          : 'Analitik / Identifikasi Workload Risk & Override PP 35/2021 (PBI-11)'
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari pegawai, kode, jabatan..."
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

        {/* Non-punitive Regulatory Callout */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#E0F2FE] border border-sky-200/80 text-xs text-[#0369A1]">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
          <p className="leading-relaxed">
            <span className="font-semibold">Model Pendukung Keputusan Non-Punitif (PP No. 35/2021):</span>{' '}
            Skor Workload Risk membantu mendeteksi ketidakseimbangan beban tugas lebih awal — bukan untuk
            menilai kinerja individu. Jika jam kerja mingguan{' '}
            <strong className="tabular-nums">≥ 55 jam</strong> atau lembur{' '}
            <strong className="tabular-nums">&gt; 4 jam/hari</strong> /{' '}
            <strong className="tabular-nums">&gt; 18 jam/minggu</strong>, sistem otomatis menandai kategori{' '}
            <strong>Risiko Tinggi (Override)</strong> agar redistribusi tugas segera dipertimbangkan.
          </p>
        </div>

        {/* Sub-Indicator Breakdown & Model Thresholds */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0284C7]" />
                <h2 className="text-base font-semibold text-[#1E293B]">
                  {isEmployee
                    ? 'Profil 4 Sub-Indikator Beban Kerja Anda'
                    : 'Rata-rata 4 Sub-Indikator & Parameter Model'}
                </h2>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                Bobot seimbang 25% per indikator · Rentang minggu:{' '}
                <strong>{filtersMeta.week_start || '-'}</strong> s.d.{' '}
                <strong>{filtersMeta.week_end || '-'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {subIndicatorBars.map((bar) => (
                <div
                  key={bar.key}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1E293B]">{bar.label}</span>
                    <span className="font-bold text-[#1E293B] tabular-nums">
                      {formatNumber(bar.score, 1)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all ${getScoreBarColor(bar.score)}`}
                      style={{ width: `${Math.min(100, Math.max(0, Number(bar.score || 0)))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{bar.hint}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Workload Risk</h2>
                <p className="text-sm text-slate-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-semibold transition cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {/* Workload Risk Table Card */}
        {!errorMsg && (
          <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold text-[#1E293B]">
                    {isEmployee
                      ? 'Riwayat & Rincian Workload Risk Saya'
                      : 'Identifikasi Risiko Beban Kerja Pegawai'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                    {risks.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadData}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
                    title="Muat ulang data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  {canRecalculate && (
                    <button
                      type="button"
                      onClick={handleRecalculate}
                      disabled={recalculating}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Calculator className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                      <span>
                        {recalculating ? 'Menghitung Ulang...' : 'Hitung Ulang Indikator'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {!isEmployee && (
                  <div className="relative w-full sm:w-52">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama atau kode..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="week"
                    value={periodWeek || filtersMeta.period_week || ''}
                    onChange={(e) => setPeriodWeek(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    aria-label="Pilih minggu periode"
                  />
                </div>

                {!isEmployee && (
                  <>
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

                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                      {RISK_FILTER_PILLS.map((pill) => (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() => setRiskCategory(pill.value)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                            riskCategory === pill.value
                              ? 'bg-white text-[#1E293B] shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setOverrideOnly((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        overrideOnly
                          ? 'bg-[#FEE2E2] border-red-200 text-[#B91C1C]'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Hanya Override PP 35/2021
                    </button>
                  </>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : risks.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1E293B] mt-3">
                  {hasActiveFilters
                    ? 'Tidak Ada Data Sesuai Filter'
                    : 'Belum Ada Data Analisis Workload Risk'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Sesuaikan pilihan minggu, departemen, kategori risiko, atau kata kunci.'
                    : 'Jalankan kalkulasi indikator untuk memproses jam aktual, lembur, tugas, dan tenggat pada minggu ini.'}
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
                  {canRecalculate && (
                    <button
                      type="button"
                      onClick={handleRecalculate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Hitung Ulang Indikator</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Data Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Pegawai</th>
                      <th className="py-3 px-4">Jam Aktual & Lembur</th>
                      <th className="py-3 px-4">Beban Tugas & Kapasitas</th>
                      <th className="py-3 px-4">4 Sub-Skor (JK / LB / BT / TD)</th>
                      <th className="py-3 px-4">Skor & Kategori</th>
                      <th className="py-3 px-4">Catatan Pendukung Keputusan</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {risks.map((row) => {
                      const emp = row.employee || {};
                      const m = row.metrics || {};
                      const riskMeta = RISK_STYLES[row.risk_category] || RISK_STYLES.low;

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition align-top">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#E0F2FE] text-[#0369A1] text-xs font-bold flex items-center justify-center shrink-0">
                                {getInitials(emp.full_name)}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[#1E293B]">
                                  {emp.full_name || '-'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-mono">{emp.employee_code || '-'}</span>
                                  {emp.department?.code ? ` · ${emp.department.code}` : ''}
                                  {emp.position?.title ? ` · ${emp.position.title}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                            <p className="font-semibold text-[#1E293B]">
                              {formatNumber(m.weekly_hours_total, 1)} /{' '}
                              {formatNumber(m.normal_weekly_hours, 0)} jam
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Lembur: {formatNumber(m.overtime_hours_total, 1)}j (
                              {m.overtime_days_count ?? 0} hari)
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                            <p className="font-medium text-[#1E293B]">
                              {formatNumber(m.active_estimated_hours, 1)}j / kapasitas{' '}
                              {formatNumber(m.available_capacity_hours, 0)}j
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {m.active_assignments_count ?? 0} tugas · tenggat dekat:{' '}
                              {m.urgent_assignments_count ?? 0}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" title="Waktu Kerja">
                                {formatNumber(row.weekly_hours_score, 0)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" title="Lembur">
                                {formatNumber(row.overtime_score, 0)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" title="Beban Tugas">
                                {formatNumber(row.task_load_score, 0)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700" title="Tekanan Tenggat">
                                {formatNumber(row.deadline_pressure_score, 0)}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${riskMeta.badgeClass}`}
                              >
                                {formatNumber(row.final_score, 1)} · {riskMeta.shortLabel}
                              </span>
                              {row.is_overridden && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                                  Override PP 35/2021
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {row.recommendation_note}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openDetailModal(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
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

      {/* Diagnostic Detail Modal */}
      {detailModalOpen && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  Diagnostik Workload Risk · {selectedRisk.period_week}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedRisk.employee?.full_name} ({selectedRisk.employee?.employee_code}) ·{' '}
                  {selectedRisk.employee?.department?.name || '-'} ·{' '}
                  {selectedRisk.employee?.employment_type?.name || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup diagnostik"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {detailLoading && (
                <p className="text-xs text-slate-400">Memuat rincian tugas dan log kerja...</p>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">Skor Akhir Rata-rata Terbobot</p>
                  <p className="text-3xl font-bold text-[#1E293B] tabular-nums mt-0.5">
                    {formatNumber(selectedRisk.final_score, 2)} / 100
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      (RISK_STYLES[selectedRisk.risk_category] || RISK_STYLES.low).badgeClass
                    }`}
                  >
                    {(RISK_STYLES[selectedRisk.risk_category] || RISK_STYLES.low).label}
                  </span>
                  {selectedRisk.is_overridden && (
                    <p className="text-xs font-semibold text-[#B91C1C] mt-1">
                      Override Wajib PP No. 35/2021 Aktif
                    </p>
                  )}
                </div>
              </div>

              {selectedRisk.override_reasons?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#FEE2E2]/50 border border-red-200 text-xs text-[#B91C1C] space-y-1">
                  <p className="font-semibold">Pemicu Override PP No. 35/2021:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {selectedRisk.override_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 4 Sub-Indicator Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  {
                    label: '1. Waktu Kerja Mingguan',
                    score: selectedRisk.weekly_hours_score,
                    note: `${formatNumber(selectedRisk.metrics?.weekly_hours_total, 1)} jam tercatat minggu ini (normal ≤ 40j, kritis ≥ 55j).`,
                  },
                  {
                    label: '2. Lembur',
                    score: selectedRisk.overtime_score,
                    note: `Sumber: ${
                      selectedRisk.metrics?.overtime_source === 'approved_overtimes'
                        ? 'Pengajuan lembur disetujui'
                        : `Work log > ${selectedRisk.metrics?.normal_daily_hours ?? 8}j/hari`
                    } (${formatNumber(selectedRisk.metrics?.overtime_hours_total, 1)}j · ${
                      selectedRisk.metrics?.overtime_days_count ?? 0
                    } hari).`,
                  },
                  {
                    label: '3. Beban Tugas vs Kapasitas',
                    score: selectedRisk.task_load_score,
                    note: `Estimasi ${formatNumber(selectedRisk.metrics?.active_estimated_hours, 1)}j · kapasitas ${formatNumber(
                      selectedRisk.metrics?.available_capacity_hours,
                      1
                    )}j (cuti disetujui: ${formatNumber(selectedRisk.metrics?.approved_leave_hours, 1)}j).`,
                  },
                  {
                    label: '4. Tekanan Tenggat',
                    score: selectedRisk.deadline_pressure_score,
                    note: `${selectedRisk.metrics?.urgent_assignments_count ?? 0} dari ${
                      selectedRisk.metrics?.active_assignments_count ?? 0
                    } tugas aktif jatuh tempo ≤ 7 hari / overdue.`,
                  },
                ].map((item) => (
                  <div key={item.label} className="p-3.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1E293B]">{item.label}</span>
                      <span className="font-bold text-[#1E293B] tabular-nums">
                        {formatNumber(item.score, 2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full ${getScoreBarColor(item.score)}`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(item.score || 0)))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{item.note}</p>
                  </div>
                ))}
              </div>

              {/* Active Assignments & Weekly Logs (if loaded from show endpoint) */}
              {Array.isArray(selectedRisk.active_assignments) && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Penugasan Aktif Terkait ({selectedRisk.active_assignments.length})
                  </p>
                  {selectedRisk.active_assignments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Tidak ada penugasan aktif.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedRisk.active_assignments.map((assign) => (
                        <div
                          key={assign.id}
                          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-[#1E293B] truncate pr-3">
                            {assign.task?.title || `Penugasan #${assign.id}`}
                          </span>
                          <span className="text-slate-500 tabular-nums shrink-0">
                            {formatNumber(assign.task?.estimated_hours, 1)}j · Tenggat:{' '}
                            {assign.deadline}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#E0F2FE]/60 border border-sky-200/70 text-xs text-[#0369A1]">
                <span className="font-semibold">Rekomendasi Non-Punitif:</span>{' '}
                {selectedRisk.recommendation_note}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Link
                to={isEmployee ? `${routePrefix}/work-logs` : `${routePrefix}/task-assignments`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition"
              >
                <span>{isEmployee ? 'Buka Catatan Waktu Kerja' : 'Kelola Penugasan & Redistribusi'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
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
    </AppShell>
  );
}
