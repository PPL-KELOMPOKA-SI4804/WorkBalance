import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  HeartHandshake,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../services/api';
import { managerDashboardService } from '../../services/managerDashboardService';

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
    strokeColor: '#10B981',
  },
  medium: {
    label: 'Risiko Sedang',
    shortLabel: 'Sedang',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    barClass: 'bg-[#F59E0B]',
    strokeColor: '#F59E0B',
  },
  high: {
    label: 'Risiko Tinggi',
    shortLabel: 'Tinggi',
    badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
    barClass: 'bg-[#EF4444]',
    strokeColor: '#EF4444',
  },
};

const DECENT_WORK_STYLES = {
  good: {
    label: 'Baik',
    badgeClass: 'bg-[#D1FAE5] text-[#047857]',
    textClass: 'text-[#047857]',
    barClass: 'bg-[#10B981]',
    strokeColor: '#10B981',
  },
  needs_attention: {
    label: 'Perlu Perhatian',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    textClass: 'text-[#B45309]',
    barClass: 'bg-[#F59E0B]',
    strokeColor: '#F59E0B',
  },
  action_priority: {
    label: 'Prioritas Tindakan',
    badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
    textClass: 'text-[#B91C1C]',
    barClass: 'bg-[#EF4444]',
    strokeColor: '#EF4444',
  },
};

const ISSUE_STATUS_STYLES = {
  open: { label: 'Menunggu', badgeClass: 'bg-[#E0F2FE] text-[#0369A1]' },
  in_progress: { label: 'Ditangani', badgeClass: 'bg-[#FEF3C7] text-[#B45309]' },
  resolved: { label: 'Selesai', badgeClass: 'bg-[#D1FAE5] text-[#047857]' },
};

const HIGHLIGHT_STYLES = {
  high: {
    cardClass: 'border-red-200/80 bg-[#FEE2E2]/35',
    badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
    badgeLabel: 'Prioritas Tinggi',
  },
  medium: {
    cardClass: 'border-amber-200/80 bg-[#FEF3C7]/35',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
    badgeLabel: 'Perlu Perhatian',
  },
  info: {
    cardClass: 'border-sky-200/80 bg-[#E0F2FE]/45',
    badgeClass: 'bg-[#E0F2FE] text-[#0369A1]',
    badgeLabel: 'Fokus Perbaikan',
  },
  low: {
    cardClass: 'border-emerald-200/80 bg-[#D1FAE5]/35',
    badgeClass: 'bg-[#D1FAE5] text-[#047857]',
    badgeLabel: 'Seimbang',
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

function formatScore(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
}

function DecentWorkGauge({ score, category }) {
  const numericScore = Math.min(100, Math.max(0, Number(score || 0)));
  const meta = DECENT_WORK_STYLES[category] || DECENT_WORK_STYLES.needs_attention;
  const radius = 64;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (numericScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160" aria-hidden="true">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={meta.strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold text-[#1E293B] tabular-nums leading-none">
            {numericScore.toFixed(1)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">dari 100</span>
          <span className={`mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeClass}`}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const routePrefix = user?.role === 'admin' ? '/admin' : '/manager';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [dashboard, setDashboard] = useState(null);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // Detail modal for inspecting a single employee's 4 sub-indicators
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await managerDashboardService.getDashboardSummary({
        department_id: departmentFilter,
        period_month: periodMonth,
        search: search.trim(),
      });
      setDashboard(data);
    } catch (err) {
      setErrorMsg(
        extractApiError(err, 'Gagal memuat ringkasan indikator kondisi kerja dan beban kerja tim.').message
      );
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, periodMonth, search]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const departments = dashboard?.departments || [];
  const kpi = dashboard?.kpi_summary || {};
  const dimensions = dashboard?.decent_work_dimensions || [];
  const departmentComparison = dashboard?.department_comparison || [];
  const employeePrioritiesAll = dashboard?.employee_priorities || [];
  const issuesSummary = dashboard?.workplace_issues_summary || {
    counts: { total: 0, open: 0, in_progress: 0, resolved: 0, resolution_rate: 100 },
    by_category: [],
    active_issues: [],
  };
  const surveySummary = dashboard?.survey_wellbeing_summary || {};
  const priorityHighlights = dashboard?.priority_highlights || [];
  const activeFiltersMeta = dashboard?.filters || {};

  const filteredEmployeePriorities = useMemo(() => {
    if (!riskFilter) return employeePrioritiesAll;
    return employeePrioritiesAll.filter((emp) => emp.risk_category === riskFilter);
  }, [employeePrioritiesAll, riskFilter]);

  const hasActiveFilters = Boolean(departmentFilter || periodMonth || search.trim() || riskFilter);

  const resetFilters = () => {
    setDepartmentFilter('');
    setPeriodMonth('');
    setSearch('');
    setRiskFilter('');
  };

  const resolveContextualRoute = (managerRoute) => {
    if (user?.role === 'admin' && managerRoute.startsWith('/manager/')) {
      return managerRoute.replace('/manager/', '/admin/');
    }
    return managerRoute;
  };

  const overallRiskMeta = RISK_STYLES[kpi.workload_risk_category] || RISK_STYLES.low;
  const decentWorkMeta = DECENT_WORK_STYLES[kpi.decent_work_category] || DECENT_WORK_STYLES.needs_attention;
  const pendingIssuesTotal = (kpi.open_issues_count ?? 0) + (kpi.in_progress_issues_count ?? 0);

  const kpiCards = [
    {
      label: 'Rata-rata Workload Risk Tim',
      value: formatScore(kpi.avg_workload_risk_score, 1),
      badge: `${overallRiskMeta.label} (${kpi.active_employees_count ?? 0} pegawai aktif)`,
      badgeClass: overallRiskMeta.badgeClass,
      icon: Activity,
      iconBg: overallRiskMeta.badgeClass,
    },
    {
      label: 'Pegawai Prioritas Perhatian',
      value: kpi.high_risk_employees_count ?? 0,
      badge: `Sedang: ${kpi.medium_risk_employees_count ?? 0} · Override PP 35/2021: ${kpi.overridden_employees_count ?? 0}`,
      badgeClass:
        (kpi.high_risk_employees_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#B91C1C]'
          : 'bg-[#D1FAE5] text-[#047857]',
      icon: ShieldAlert,
      iconBg:
        (kpi.high_risk_employees_count ?? 0) > 0
          ? 'bg-[#FEE2E2] text-[#EF4444]'
          : 'bg-[#D1FAE5] text-[#10B981]',
    },
    {
      label: 'Decent Work Score Tim',
      value: formatScore(kpi.decent_work_score, 1),
      badge: `Kategori: ${decentWorkMeta.label} (Skala 0–100)`,
      badgeClass: decentWorkMeta.badgeClass,
      icon: ShieldCheck,
      iconBg: decentWorkMeta.badgeClass,
    },
    {
      label: 'Masalah Kerja & Tenggat Dekat',
      value: pendingIssuesTotal,
      badge: `${kpi.open_issues_count ?? 0} isu menunggu · ${kpi.urgent_assignments_count ?? 0} tugas tenggat ≤7h`,
      badgeClass:
        (kpi.open_issues_count ?? 0) > 0 || (kpi.overdue_assignments_count ?? 0) > 0
          ? 'bg-[#FEF3C7] text-[#B45309]'
          : 'bg-[#E0F2FE] text-[#0369A1]',
      icon: MessageSquareWarning,
      iconBg:
        (kpi.open_issues_count ?? 0) > 0
          ? 'bg-[#FEF3C7] text-[#F59E0B]'
          : 'bg-[#E0F2FE] text-[#0284C7]',
    },
  ];

  return (
    <AppShell
      title="Dasbor Kondisi Kerja & Beban Tim"
      breadcrumb={`Analitik & Pengelolaan Tim / Ringkasan Indikator (PBI-10)${
        activeFiltersMeta.period_week ? ` · Minggu ${activeFiltersMeta.period_week}` : ''
      }`}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari nama pegawai, jabatan, atau isu..."
    >
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <section className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E0F2FE] text-[#0369A1] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Periode Minggu: {activeFiltersMeta.week_start || '-'} s.d.{' '}
                {activeFiltersMeta.week_end || '-'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium tabular-nums">
              Total Jam Tercatat Minggu Ini: {formatScore(kpi.weekly_logged_hours_total, 1)}j · Tugas Aktif:{' '}
              {formatScore(kpi.active_estimated_hours_total, 1)}j
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
              aria-label="Filter departemen"
            >
              <option value="">Semua Departemen</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} — {dept.name} ({dept.active_employees_count})
                </option>
              ))}
            </select>

            <input
              type="month"
              value={periodMonth || activeFiltersMeta.period_month || ''}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:border-[#0284C7] focus:outline-none"
              aria-label="Filter periode bulan"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Reset Filter
              </button>
            )}

            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>
        </section>

        {/* Error State */}
        {errorMsg && (
          <div className="bg-white rounded-xl border border-red-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1E293B]">Gagal Memuat Dasbor Kondisi Kerja</h2>
                <p className="text-sm text-slate-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-semibold transition cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !errorMsg && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="h-32 bg-white rounded-xl border border-slate-200/80 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 h-80 bg-white rounded-xl border border-slate-200/80 animate-pulse" />
              <div className="xl:col-span-4 h-80 bg-white rounded-xl border border-slate-200/80 animate-pulse" />
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && !errorMsg && dashboard && (
          <>
            {/* Row 1: 4 KPI Summary Cards */}
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

            {/* Row 2: Department Comparison + Priority Highlights (Left 65%) & Decent Work Gauge (Right 35%) */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                {/* Department Comparison Card */}
                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-[#0284C7]" />
                      <h2 className="text-base font-semibold text-[#1E293B]">
                        Perbandingan Indikator Antar-Departemen
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {departmentComparison.length} departemen ditampilkan
                    </span>
                  </div>

                  {departmentComparison.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Belum ada data departemen pada cakupan filter saat ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {departmentComparison.map((dept) => {
                        const dwMeta =
                          DECENT_WORK_STYLES[dept.status_category] || DECENT_WORK_STYLES.needs_attention;
                        return (
                          <div key={dept.department_id} className="p-5 hover:bg-slate-50/60 transition">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                                    {dept.code}
                                  </span>
                                  <h3 className="text-sm font-semibold text-[#1E293B]">{dept.name}</h3>
                                  <span className="text-xs text-slate-400 tabular-nums">
                                    ({dept.active_employees_count} pegawai)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${dwMeta.badgeClass}`}>
                                  Decent Work: {formatScore(dept.decent_work_score, 1)} ({dwMeta.label})
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
                              <div>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-slate-500">Rata-rata Workload Risk</span>
                                  <span className="font-semibold text-[#1E293B] tabular-nums">
                                    {formatScore(dept.avg_workload_risk_score, 1)} / 100
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      dept.avg_workload_risk_score >= 70
                                        ? 'bg-[#EF4444]'
                                        : dept.avg_workload_risk_score >= 40
                                          ? 'bg-[#F59E0B]'
                                          : 'bg-[#10B981]'
                                    }`}
                                    style={{ width: `${Math.min(100, dept.avg_workload_risk_score)}%` }}
                                  />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                                  Tinggi: {dept.high_risk_count} · Sedang: {dept.medium_risk_count} · Rendah:{' '}
                                  {dept.low_risk_count}
                                </p>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                  <p className="text-[11px] text-slate-400">Jam Aktual / Tugas</p>
                                  <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                                    {formatScore(dept.weekly_hours_total, 1)}j /{' '}
                                    {formatScore(dept.estimated_hours_total, 0)}j
                                  </p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                  <p className="text-[11px] text-slate-400">Masalah Aktif</p>
                                  <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                                    {dept.open_issues_count + dept.in_progress_issues_count} isu
                                  </p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                  <p className="text-[11px] text-slate-400">Survei WLB (Agregat)</p>
                                  <p className="font-semibold text-[#1E293B] tabular-nums mt-0.5">
                                    {dept.survey_avg_wlb !== null ? `${dept.survey_avg_wlb} / 5` : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rule-Based Priority Highlights */}
                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                      <h2 className="text-base font-semibold text-[#1E293B]">
                        Pemicu Prioritas Pengelolaan Tim
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">Deterministik berbasis ambang indikator</span>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {priorityHighlights.map((item) => {
                      const style = HIGHLIGHT_STYLES[item.severity] || HIGHLIGHT_STYLES.info;
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${style.cardClass}`}
                        >
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${style.badgeClass}`}>
                              {style.badgeLabel}
                            </span>
                            <h3 className="text-sm font-semibold text-[#1E293B] mt-2">{item.title}</h3>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                          </div>

                          <Link
                            to={resolveContextualRoute(item.action_route)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:text-[#0369A1]"
                          >
                            <span>{item.action_label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 35%: Decent Work Radial Gauge + 6 Dimensions + Survey Aggregate */}
              <div className="xl:col-span-4 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-[#1E293B]">Decent Work Score</h2>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      Periode {activeFiltersMeta.period_month}
                    </span>
                  </div>

                  <DecentWorkGauge
                    score={kpi.decent_work_score}
                    category={kpi.decent_work_category}
                  />

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {dimensions.map((dim) => {
                      const meta =
                        DECENT_WORK_STYLES[dim.status_category] || DECENT_WORK_STYLES.needs_attention;
                      return (
                        <div key={dim.key}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">{dim.label}</span>
                            <span className={`font-bold tabular-nums ${meta.textClass}`}>
                              {formatScore(dim.score, 1)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${meta.barClass}`}
                              style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{dim.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Aggregated Wellbeing Survey Card (NFR-02) */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="w-4 h-4 text-[#10B981]" />
                      <h2 className="text-sm font-semibold text-[#1E293B]">Survei Kondisi Kerja</h2>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E0F2FE] text-[#0369A1]">
                      Agregat NFR-02
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    {surveySummary.survey_title || `Periode ${activeFiltersMeta.period_month}`}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Skor WLB</p>
                      <p className="text-sm font-bold text-[#1E293B] tabular-nums mt-0.5">
                        {surveySummary.avg_wlb_score !== null && surveySummary.avg_wlb_score !== undefined
                          ? `${surveySummary.avg_wlb_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Persepsi Beban</p>
                      <p className="text-sm font-bold text-[#1E293B] tabular-nums mt-0.5">
                        {surveySummary.avg_workload_perception_score !== null &&
                        surveySummary.avg_workload_perception_score !== undefined
                          ? `${surveySummary.avg_workload_perception_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Partisipasi</p>
                      <p className="text-sm font-bold text-[#047857] tabular-nums mt-0.5">
                        {formatScore(surveySummary.participation_rate, 1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Row 3: Employee Priority List (8 cols) + Active Workplace Issues (4 cols) */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Employee Workload Priorities Table */}
              <div className="xl:col-span-8 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-[#0284C7]" />
                    <h2 className="text-base font-semibold text-[#1E293B]">
                      Daftar Pegawai Prioritas Perhatian
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                      {filteredEmployeePriorities.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-48">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari pegawai..."
                        className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>

                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                      {RISK_FILTER_PILLS.map((pill) => (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() => setRiskFilter(pill.value)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                            riskFilter === pill.value
                              ? 'bg-white text-[#1E293B] shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredEmployeePriorities.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    Tidak ada pegawai yang sesuai dengan filter risiko atau pencarian saat ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Pegawai</th>
                          <th className="py-3 px-4">Jam Kerja</th>
                          <th className="py-3 px-4">Beban & Tenggat</th>
                          <th className="py-3 px-4">Workload Risk</th>
                          <th className="py-3 px-4">Catatan Prioritas</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredEmployeePriorities.map((emp) => {
                          const riskMeta = RISK_STYLES[emp.risk_category] || RISK_STYLES.low;
                          return (
                            <tr key={emp.employee_id} className="hover:bg-slate-50/70 transition align-top">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-[#E0F2FE] text-[#0369A1] text-xs font-bold flex items-center justify-center shrink-0">
                                    {getInitials(emp.full_name)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-[#1E293B]">{emp.full_name}</p>
                                    <p className="text-[11px] text-slate-500">
                                      {emp.position_title || '-'} · {emp.department?.code || '-'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                                <p className="font-semibold text-[#1E293B]">
                                  {formatScore(emp.weekly_hours_total, 1)} /{' '}
                                  {formatScore(emp.normal_weekly_hours, 0)} jam
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Lembur: {formatScore(emp.overtime_hours_total, 1)}j
                                </p>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap text-xs tabular-nums">
                                <p className="font-medium text-[#1E293B]">
                                  {emp.active_assignments_count} tugas ({formatScore(emp.active_estimated_hours, 1)}j)
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Lewat tenggat: {emp.overdue_assignments_count} · ≤7h: {emp.due_soon_assignments_count}
                                </p>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${riskMeta.badgeClass}`}
                                  >
                                    {formatScore(emp.final_score, 1)} · {riskMeta.shortLabel}
                                  </span>
                                  {emp.is_overridden && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                                      Override PP 35/2021
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                  {emp.priority_reason}
                                </p>
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmployee(emp)}
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
              </div>

              {/* Active Workplace Issues Summary Panel */}
              <div className="xl:col-span-4 bg-white rounded-xl border border-slate-200/80 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquareWarning className="w-4 h-4 text-[#0284C7]" />
                    <h2 className="text-base font-semibold text-[#1E293B]">Permasalahan Kerja Tim</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#047857] tabular-nums">
                    {formatScore(issuesSummary.counts.resolution_rate, 1)}% selesai
                  </span>
                </div>

                <div className="p-4 border-b border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-[#E0F2FE]/60">
                    <p className="text-[11px] text-[#0369A1] font-medium">Menunggu</p>
                    <p className="text-base font-bold text-[#1E293B] tabular-nums">
                      {issuesSummary.counts.open}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FEF3C7]/60">
                    <p className="text-[11px] text-[#B45309] font-medium">Ditangani</p>
                    <p className="text-base font-bold text-[#1E293B] tabular-nums">
                      {issuesSummary.counts.in_progress}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#D1FAE5]/60">
                    <p className="text-[11px] text-[#047857] font-medium">Selesai</p>
                    <p className="text-base font-bold text-[#1E293B] tabular-nums">
                      {issuesSummary.counts.resolved}
                    </p>
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-96">
                  {issuesSummary.active_issues.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto" />
                      <p className="text-xs font-semibold text-[#1E293B] mt-2">
                        Tidak Ada Permasalahan Aktif
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Seluruh laporan pada cakupan departemen telah ditangani.
                      </p>
                    </div>
                  ) : (
                    issuesSummary.active_issues.map((issue) => {
                      const stMeta = ISSUE_STATUS_STYLES[issue.status] || ISSUE_STATUS_STYLES.open;
                      return (
                        <div
                          key={issue.id}
                          className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {issue.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${stMeta.badgeClass}`}>
                              {stMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {issue.description}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {issue.reporter?.full_name || '-'} · {issue.department?.code || '-'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <Link
                    to={`${routePrefix}/workplace-issues`}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition"
                  >
                    <span>Kelola & Tindak Lanjuti Permasalahan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Employee 4 Sub-Indicator Breakdown Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">
                  Rincian 4 Sub-Indikator Beban Kerja
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedEmployee.full_name} ({selectedEmployee.employee_code}) ·{' '}
                  {selectedEmployee.department?.name || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup detail indikator"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">Skor Akhir Workload Risk</p>
                  <p className="text-2xl font-bold text-[#1E293B] tabular-nums mt-0.5">
                    {formatScore(selectedEmployee.final_score, 2)} / 100
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      (RISK_STYLES[selectedEmployee.risk_category] || RISK_STYLES.low).badgeClass
                    }`}
                  >
                    {(RISK_STYLES[selectedEmployee.risk_category] || RISK_STYLES.low).label}
                  </span>
                  {selectedEmployee.is_overridden && (
                    <p className="text-[11px] font-semibold text-[#B91C1C] mt-1">
                      Override Wajib PP No. 35/2021
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: '1. Waktu Kerja Mingguan',
                    score: selectedEmployee.weekly_hours_score,
                    note: `${formatScore(selectedEmployee.weekly_hours_total, 1)} jam aktual minggu ini (batas sehat <= 40j, kritis >= 55j).`,
                  },
                  {
                    label: '2. Lembur',
                    score: selectedEmployee.overtime_score,
                    note: `${selectedEmployee.overtime_days_count} hari lembur · total ${formatScore(
                      selectedEmployee.overtime_hours_total,
                      1
                    )}j (maks harian ${formatScore(selectedEmployee.max_daily_overtime_hours, 1)}j).`,
                  },
                  {
                    label: '3. Beban Tugas vs Kapasitas Efektif',
                    score: selectedEmployee.task_load_score,
                    note: `Tugas aktif ${formatScore(selectedEmployee.active_estimated_hours, 1)}j · kapasitas tersedia ${formatScore(
                      selectedEmployee.available_capacity_hours,
                      1
                    )}j (cuti disetujui: ${formatScore(selectedEmployee.approved_leave_hours, 1)}j).`,
                  },
                  {
                    label: '4. Tekanan Tenggat',
                    score: selectedEmployee.deadline_pressure_score,
                    note: `${selectedEmployee.urgent_assignments_count} dari ${selectedEmployee.active_assignments_count} tugas aktif lewat tenggat / <= 7 hari.`,
                  },
                ].map((sub) => (
                  <div key={sub.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1E293B]">{sub.label}</span>
                      <span className="font-bold text-[#1E293B] tabular-nums">
                        {formatScore(sub.score, 1)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${
                          sub.score >= 70
                            ? 'bg-[#EF4444]'
                            : sub.score >= 40
                              ? 'bg-[#F59E0B]'
                              : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, sub.score))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sub.note}</p>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#E0F2FE]/60 border border-sky-200/70 text-xs text-[#0369A1]">
                <span className="font-semibold">Rekomendasi Prioritas:</span>{' '}
                {selectedEmployee.priority_reason}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Link
                to={`${routePrefix}/task-assignments`}
                className="px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold transition"
              >
                Kelola Penugasan Pegawai
              </Link>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
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
