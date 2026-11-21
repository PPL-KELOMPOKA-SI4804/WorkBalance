import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  HeartHandshake,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { managerDashboardService } from '@/services/managerDashboardService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DataTable,
  DecentWorkDonutChart,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

const ALL_DEPARTMENTS_VALUE = '__all__';

const SEVERITY_TONES = {
  high: { tone: 'danger', label: 'Prioritas Tinggi' },
  medium: { tone: 'warning', label: 'Perlu Perhatian' },
  info: { tone: 'info', label: 'Fokus Perbaikan' },
  low: { tone: 'success', label: 'Seimbang' },
};

const DEPT_CHART_CONFIG = {
  decent_work_score: { label: 'Decent Work Score', color: 'var(--chart-2)' },
  avg_workload_risk_score: { label: 'Workload Risk', color: 'var(--chart-1)' },
};

function formatScore(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
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
  const [riskFilter, setRiskFilter] = useState('all');

  // Slide-over detail sheet for single employee 4 sub-indicators
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
        extractApiError(
          err,
          'Gagal memuat ringkasan indikator kondisi kerja dan beban kerja tim.'
        ).message
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
    if (!riskFilter || riskFilter === 'all') return employeePrioritiesAll;
    return employeePrioritiesAll.filter((emp) => emp.risk_category === riskFilter);
  }, [employeePrioritiesAll, riskFilter]);

  const deptChartData = useMemo(
    () =>
      departmentComparison.map((dept) => ({
        code: dept.code,
        name: dept.name,
        decent_work_score: Number(Number(dept.decent_work_score || 0).toFixed(1)),
        avg_workload_risk_score: Number(Number(dept.avg_workload_risk_score || 0).toFixed(1)),
      })),
    [departmentComparison]
  );

  const hasActiveFilters = Boolean(
    departmentFilter || periodMonth || search.trim() || (riskFilter && riskFilter !== 'all')
  );

  const resetFilters = () => {
    setDepartmentFilter('');
    setPeriodMonth('');
    setSearch('');
    setRiskFilter('all');
  };

  const resolveContextualRoute = (managerRoute) => {
    if (user?.role === 'admin' && managerRoute?.startsWith('/manager/')) {
      return managerRoute.replace('/manager/', '/admin/');
    }
    return managerRoute || `${routePrefix}/workload-risk`;
  };

  const pendingIssuesTotal =
    (kpi.open_issues_count ?? 0) + (kpi.in_progress_issues_count ?? 0);

  const employeeColumns = useMemo(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {emp.full_name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {emp.position_title || '-'} ·{' '}
                  <span className="font-mono">{emp.department?.code || '-'}</span>
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'weekly_hours_total',
        header: 'Jam Kerja',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex flex-col font-mono text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {formatScore(emp.weekly_hours_total, 1)} /{' '}
                {formatScore(emp.normal_weekly_hours, 0)}j
              </span>
              <span className="text-[11px] text-muted-foreground">
                Lembur {formatScore(emp.overtime_hours_total, 1)}j
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'active_assignments_count',
        header: 'Beban & Tenggat',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex flex-col text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {emp.active_assignments_count} tugas (
                <span className="font-mono">{formatScore(emp.active_estimated_hours, 1)}j</span>)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Lewat: {emp.overdue_assignments_count} · ≤7h: {emp.due_soon_assignments_count}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'final_score',
        header: 'Workload Risk',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
              <StatusBadge
                status={emp.risk_category}
                label={`${formatScore(emp.final_score, 1)} · ${
                  emp.risk_category === 'high'
                    ? 'Tinggi'
                    : emp.risk_category === 'medium'
                      ? 'Sedang'
                      : 'Rendah'
                }`}
              />
              {emp.is_overridden && (
                <StatusBadge status="override" label="PP 35" showDot={false} />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'priority_reason',
        header: 'Catatan Prioritas',
        enableSorting: false,
        cell: ({ row }) => (
          <p className="max-w-sm line-clamp-2 text-xs leading-relaxed text-muted-foreground whitespace-normal">
            {row.original.priority_reason}
          </p>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedEmployee(row.original);
              }}
            >
              <Eye data-icon="inline-start" />
              Detail
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <AppShell
      title="Dasbor Kondisi Kerja & Beban Tim"
      breadcrumb={`Analitik Tim / Ringkasan Indikator${
        activeFiltersMeta.period_week ? ` · ${activeFiltersMeta.period_week}` : ''
      }`}
    >
      <div className="flex flex-col gap-6">
        {/* Compact Unified Filter Bar */}
        <section className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 text-primary" />
              <span className="font-mono tabular-nums">
                {activeFiltersMeta.week_start || '-'} s.d. {activeFiltersMeta.week_end || '-'}
              </span>
            </span>
            <span className="hidden text-border sm:inline" aria-hidden="true">·</span>
            <span className="tabular-nums">
              Jam tercatat:{' '}
              <span className="font-mono font-medium text-foreground">
                {formatScore(kpi.weekly_logged_hours_total, 1)}j
              </span>{' '}
              · Tugas aktif:{' '}
              <span className="font-mono font-medium text-foreground">
                {formatScore(kpi.active_estimated_hours_total, 1)}j
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={departmentFilter || ALL_DEPARTMENTS_VALUE}
              onValueChange={(val) =>
                setDepartmentFilter(val === ALL_DEPARTMENTS_VALUE ? '' : val)
              }
            >
              <SelectTrigger size="sm" className="w-52 bg-background text-xs">
                <SelectValue placeholder="Semua Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL_DEPARTMENTS_VALUE}>Semua Departemen</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.code} — {dept.name} ({dept.active_employees_count})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <input
              id="mgr-period-month"
              name="period_month"
              type="month"
              value={periodMonth || activeFiltersMeta.period_month || ''}
              onChange={(e) => setPeriodMonth(e.target.value)}
              aria-label="Filter periode bulan"
              className="h-8 rounded-lg border border-input bg-background px-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
              <RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : ''} />
              Muat Ulang
            </Button>
          </div>
        </section>

        {/* Error State */}
        {errorMsg && (
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-card p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-foreground">
                  Gagal Memuat Dasbor Kondisi Kerja
                </h2>
                <p className="text-xs text-muted-foreground">{errorMsg}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadDashboard}>
              <RefreshCw data-icon="inline-start" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && !errorMsg && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((card) => (
                <Skeleton key={card} className="h-32 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Skeleton className="h-80 rounded-xl xl:col-span-8" />
              <Skeleton className="h-80 rounded-xl xl:col-span-4" />
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && !errorMsg && dashboard && (
          <>
            {/* Row 1: 4 Executive KPI Cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiStatCard
                label="Rata-rata Workload Risk Tim"
                value={formatScore(kpi.avg_workload_risk_score, 1)}
                unit="/ 100"
                icon={Activity}
                status={kpi.workload_risk_category || 'low'}
                hint={`${kpi.active_employees_count ?? 0} pegawai aktif`}
              />

              <KpiStatCard
                label="Pegawai Prioritas Perhatian"
                value={kpi.high_risk_employees_count ?? 0}
                unit="pegawai"
                icon={ShieldAlert}
                status={(kpi.high_risk_employees_count ?? 0) > 0 ? 'high' : 'low'}
                statusLabel={
                  (kpi.high_risk_employees_count ?? 0) > 0
                    ? `Override PP 35: ${kpi.overridden_employees_count ?? 0}`
                    : 'Tidak ada risiko tinggi'
                }
                hint={`Sedang: ${kpi.medium_risk_employees_count ?? 0}`}
              />

              <KpiStatCard
                label="Decent Work Score Tim"
                value={formatScore(kpi.decent_work_score, 1)}
                unit="/ 100"
                icon={ShieldCheck}
                status={kpi.decent_work_category || 'needs_attention'}
                hint={`Periode ${activeFiltersMeta.period_month || '-'}`}
              />

              <KpiStatCard
                label="Masalah Kerja & Tenggat"
                value={pendingIssuesTotal}
                unit="aktif"
                icon={MessageSquareWarning}
                status={
                  (kpi.open_issues_count ?? 0) > 0 || (kpi.overdue_assignments_count ?? 0) > 0
                    ? 'warning'
                    : 'info'
                }
                statusLabel={`${kpi.open_issues_count ?? 0} menunggu`}
                hint={`${kpi.urgent_assignments_count ?? 0} tugas ≤7h`}
              />
            </section>

            {/* Row 2: Department Comparison + Priority Highlights (8 cols) | Decent Work Donut & Survey Aggregate (4 cols) */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="flex flex-col gap-6 xl:col-span-8">
                {/* Interactive Recharts Department Comparison Card */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <Tabs defaultValue="chart" className="w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                          Perbandingan Indikator Antar-Departemen
                        </h2>
                      </div>
                      <TabsList className="h-8">
                        <TabsTrigger value="chart" className="text-xs">
                          Grafik
                        </TabsTrigger>
                        <TabsTrigger value="breakdown" className="text-xs">
                          Rincian ({departmentComparison.length})
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="chart" className="m-0 p-5">
                      {deptChartData.length === 0 ? (
                        <p className="py-12 text-center text-xs text-muted-foreground">
                          Belum ada data departemen pada cakupan filter saat ini.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>Perbandingan skor rata-rata tiap departemen (skala 0–100)</span>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-xs bg-[var(--chart-2)]" />
                                Decent Work
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-xs bg-[var(--chart-1)]" />
                                Workload Risk
                              </span>
                            </div>
                          </div>

                          <ChartContainer
                            config={DEPT_CHART_CONFIG}
                            className="h-64 w-full aspect-auto"
                          >
                            <BarChart
                              data={deptChartData}
                              margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis
                                dataKey="code"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar
                                dataKey="decent_work_score"
                                fill="var(--color-decent_work_score)"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                              />
                              <Bar
                                dataKey="avg_workload_risk_score"
                                fill="var(--color-avg_workload_risk_score)"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                              />
                            </BarChart>
                          </ChartContainer>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="breakdown" className="m-0 divide-y divide-border">
                      {departmentComparison.length === 0 ? (
                        <p className="p-8 text-center text-xs text-muted-foreground">
                          Belum ada data departemen pada cakupan filter saat ini.
                        </p>
                      ) : (
                        departmentComparison.map((dept) => (
                          <div
                            key={dept.department_id}
                            className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                                  {dept.code}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {dept.name}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  · {dept.active_employees_count} pegawai
                                </span>
                              </div>
                              <StatusBadge
                                status={dept.status_category}
                                label={`Decent Work ${formatScore(dept.decent_work_score, 1)}`}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Workload Risk
                                </span>
                                <span className="font-mono font-semibold text-foreground tabular-nums">
                                  {formatScore(dept.avg_workload_risk_score, 1)} / 100
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Jam Aktual / Tugas
                                </span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {formatScore(dept.weekly_hours_total, 1)}j /{' '}
                                  {formatScore(dept.estimated_hours_total, 0)}j
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Masalah Aktif
                                </span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {dept.open_issues_count + dept.in_progress_issues_count} isu
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Survei WLB (Agregat)
                                </span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {dept.survey_avg_wlb !== null ? `${dept.survey_avg_wlb} / 5` : '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Rule-Based Priority Highlights & Active Issues (Balanced 2-column sub-grid inside 8-col left rail) */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Rule-Based Priority Highlights */}
                  <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card lg:col-span-7">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                      <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                        Pemicu Prioritas Tim
                      </h2>
                      <span className="text-[11px] text-muted-foreground">
                        Deterministik ambang indikator
                      </span>
                    </div>

                    <div className="flex-1 divide-y divide-border">
                      {priorityHighlights.map((item) => {
                        const sev = SEVERITY_TONES[item.severity] || SEVERITY_TONES.info;
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2.5 px-5 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <StatusBadge tone={sev.tone} label={sev.label} />
                              <Link
                                to={resolveContextualRoute(item.action_route)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                <span>{item.action_label}</span>
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                            <h3 className="text-sm font-medium text-foreground">
                              {item.title}
                            </h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Workplace Issues Panel */}
                  <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card lg:col-span-5">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
                      <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                        Permasalahan Kerja
                      </h2>
                      <StatusBadge
                        tone="success"
                        label={`${formatScore(issuesSummary.counts.resolution_rate, 0)}% selesai`}
                        showDot={false}
                      />
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20 py-2.5 text-center">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Menunggu</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                          {issuesSummary.counts.open}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Ditangani</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                          {issuesSummary.counts.in_progress}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Selesai</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                          {issuesSummary.counts.resolved}
                        </p>
                      </div>
                    </div>

                    <div className="max-h-72 flex-1 divide-y divide-border overflow-y-auto">
                      {issuesSummary.active_issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                          <CheckCircle2 className="size-7 text-emerald-600" />
                          <p className="text-xs font-medium text-foreground">
                            Tidak ada permasalahan aktif
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Seluruh laporan departemen telah ditangani.
                          </p>
                        </div>
                      ) : (
                        issuesSummary.active_issues.map((issue) => (
                          <div key={issue.id} className="flex flex-col gap-1.5 px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium text-foreground">
                                {issue.category}
                              </span>
                              <StatusBadge status={issue.status} />
                            </div>
                            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {issue.description}
                            </p>
                            <p className="text-[11px] text-muted-foreground/80">
                              {issue.reporter?.full_name || '-'} ·{' '}
                              <span className="font-mono">{issue.department?.code || '-'}</span>
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-border bg-muted/20 p-3">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to={`${routePrefix}/workplace-issues`}>
                          Kelola Permasalahan
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Recharts Decent Work Donut + 6 Dimensions + Survey Aggregate */}
              <div className="flex flex-col gap-6 xl:col-span-4">
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                      Decent Work Score
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {activeFiltersMeta.period_month}
                    </span>
                  </div>

                  <DecentWorkDonutChart
                    score={kpi.decent_work_score}
                    category={kpi.decent_work_category}
                  />

                  <Separator />

                  <div className="flex flex-col gap-3">
                    {dimensions.map((dim) => (
                      <div key={dim.key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{dim.label}</span>
                          <span className="font-mono font-semibold text-foreground tabular-nums">
                            {formatScore(dim.score, 1)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, Math.max(0, Number(dim.score || 0)))}
                          className="h-1.5"
                        />
                        <p className="text-[11px] text-muted-foreground">{dim.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggregated Survey Card (Strict NFR-02 Privacy) */}
                <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                        Survei Kondisi Kerja
                      </h2>
                    </div>
                    <StatusBadge tone="info" label="Agregat NFR-02" showDot={false} />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {surveySummary.survey_title || `Periode ${activeFiltersMeta.period_month}`}
                  </p>

                  <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/30 py-3 text-center">
                    <div className="px-2">
                      <p className="text-[11px] text-muted-foreground">Skor WLB</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                        {surveySummary.avg_wlb_score != null
                          ? `${surveySummary.avg_wlb_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-[11px] text-muted-foreground">Beban</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">
                        {surveySummary.avg_workload_perception_score != null
                          ? `${surveySummary.avg_workload_perception_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-[11px] text-muted-foreground">Partisipasi</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-700 tabular-nums">
                        {formatScore(surveySummary.participation_rate, 1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Row 3: Full-Width Employee Priority DataTable (Zero horizontal clipping at 1440px!) */}
            <section>
              <DataTable
                title="Daftar Pegawai Prioritas Perhatian"
                countLabel="pegawai"
                columns={employeeColumns}
                data={filteredEmployeePriorities}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Cari nama pegawai atau jabatan..."
                pageSize={8}
                onRowClick={(emp) => setSelectedEmployee(emp)}
                emptyTitle="Tidak ada pegawai sesuai filter"
                emptyDescription="Ubah filter kategori risiko atau kata kunci untuk melihat pegawai lain."
                filterSlot={
                  <ToggleGroup
                    type="single"
                    value={riskFilter}
                    onValueChange={(val) => val && setRiskFilter(val)}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="all" className="text-xs">
                      Semua
                    </ToggleGroupItem>
                    <ToggleGroupItem value="high" className="text-xs">
                      Tinggi
                    </ToggleGroupItem>
                    <ToggleGroupItem value="medium" className="text-xs">
                      Sedang
                    </ToggleGroupItem>
                    <ToggleGroupItem value="low" className="text-xs">
                      Rendah
                    </ToggleGroupItem>
                  </ToggleGroup>
                }
              />
            </section>
          </>
        )}
      </div>

      {/* Employee 360° Workload Sub-Indicators Slide-Over Sheet */}
      <FormSheet
        open={Boolean(selectedEmployee)}
        onOpenChange={(open) => !open && setSelectedEmployee(null)}
        title="Rincian 4 Sub-Indikator Beban Kerja"
        description={
          selectedEmployee
            ? `${selectedEmployee.full_name} (${selectedEmployee.employee_code}) · ${
                selectedEmployee.department?.name || '-'
              }`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelectedEmployee(null)}>
              Tutup
            </Button>
            <Button asChild>
              <Link to={`${routePrefix}/task-assignments`}>
                Kelola Penugasan Pegawai
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      >
        {selectedEmployee && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Skor Akhir Workload Risk</span>
                <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                  {formatScore(selectedEmployee.final_score, 2)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={selectedEmployee.risk_category} />
                {selectedEmployee.is_overridden && (
                  <StatusBadge status="override" showDot={false} />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                {
                  label: '1. Waktu Kerja Mingguan',
                  score: selectedEmployee.weekly_hours_score,
                  note: `${formatScore(selectedEmployee.weekly_hours_total, 1)} jam aktual minggu ini (batas sehat ≤ 40j, kritis ≥ 55j).`,
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
                  note: `Tugas aktif ${formatScore(
                    selectedEmployee.active_estimated_hours,
                    1
                  )}j · kapasitas tersedia ${formatScore(
                    selectedEmployee.available_capacity_hours,
                    1
                  )}j (cuti disetujui: ${formatScore(selectedEmployee.approved_leave_hours, 1)}j).`,
                },
                {
                  label: '4. Tekanan Tenggat',
                  score: selectedEmployee.deadline_pressure_score,
                  note: `${selectedEmployee.urgent_assignments_count} dari ${selectedEmployee.active_assignments_count} tugas aktif lewat tenggat / ≤ 7 hari.`,
                },
              ].map((sub) => (
                <div key={sub.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{sub.label}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatScore(sub.score, 1)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, Number(sub.score || 0)))}
                    className="h-1.5"
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{sub.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Catatan Non-Punitif: </span>
              {selectedEmployee.priority_reason}
            </div>
          </div>
        )}
      </FormSheet>
    </AppShell>
  );
}
