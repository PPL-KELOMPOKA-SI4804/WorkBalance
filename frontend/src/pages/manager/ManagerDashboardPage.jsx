import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  MessageSquareWarning,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatDate, formatMonth } from '@/lib/format';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AnimatedNumber,
  DataTable,
  DecentWorkDonutChart,
  FormSheet,
  HeroBentoCard,
  MonthPicker,
  PerformanceLineChart,
  StatusBadge,
  TruncatedText,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const SEVERITY_TONES = {
  high: { tone: 'danger', label: 'Prioritas Tinggi' },
  medium: { tone: 'warning', label: 'Perlu Perhatian' },
  info: { tone: 'info', label: 'Fokus Perbaikan' },
  low: { tone: 'success', label: 'Seimbang' },
};

const DEPT_CHART_CONFIG = {
  decent_work_score: { label: 'Decent Work', color: 'var(--chart-2)' },
  avg_workload_risk_score: { label: 'Workload Risk', color: 'var(--chart-3)' },
};

function formatScore(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
}

function getGreetingName(user) {
  const full = user?.employee?.full_name?.trim();
  if (full) return full.split(/\s+/)[0];
  if (user?.role === 'admin') return 'Admin';
  if (user?.role === 'manager') return 'Manajer';
  return 'Tim';
}

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const routePrefix = user?.role === 'admin' ? '/admin' : '/manager';
  const greetingName = getGreetingName(user);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [dashboard, setDashboard] = useState(null);

  // Filters & local view state
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState(ALL_VALUE);
  const [deptView, setDeptView] = useState('chart');

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
          'Gagal memuat ringkasan kondisi kerja tim.'
        ).message
      );
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, periodMonth, search]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useRefetchOnFocus(loadDashboard);

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
    if (!riskFilter || riskFilter === ALL_VALUE) return employeePrioritiesAll;
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
    departmentFilter || periodMonth || search.trim() || riskFilter !== ALL_VALUE
  );

  const resetFilters = () => {
    setDepartmentFilter('');
    setPeriodMonth('');
    setSearch('');
    setRiskFilter(ALL_VALUE);
  };

  const resolveContextualRoute = (managerRoute) => {
    if (user?.role === 'admin' && managerRoute?.startsWith('/manager/')) {
      return managerRoute.replace('/manager/', '/admin/');
    }
    return managerRoute || `${routePrefix}/workload-risk`;
  };

  const pendingIssuesTotal =
    (kpi.open_issues_count ?? 0) + (kpi.in_progress_issues_count ?? 0);

  const heroMetrics = useMemo(
    () => [
      {
        key: 'workload-risk',
        label: 'Workload Risk Tim',
        value: formatScore(kpi.avg_workload_risk_score, 1),
        unit: '/ 100',
        icon: Activity,
        status: kpi.workload_risk_category || 'low',
      },
      {
        key: 'high-risk',
        label: 'Risiko Tinggi',
        value: kpi.high_risk_employees_count ?? 0,
        unit: 'pegawai',
        icon: ShieldAlert,
        hint: `Sedang ${kpi.medium_risk_employees_count ?? 0} · Override ${
          kpi.overridden_employees_count ?? 0
        }`,
      },
      {
        key: 'decent-work',
        label: 'Decent Work Score',
        value: formatScore(kpi.decent_work_score, 1),
        unit: '/ 100',
        icon: ShieldCheck,
        status: kpi.decent_work_category || 'needs_attention',
      },
      {
        key: 'issues-deadlines',
        label: 'Isu & Tenggat',
        value: pendingIssuesTotal,
        unit: 'aktif',
        icon: MessageSquareWarning,
        hint: `${kpi.open_issues_count ?? 0} menunggu · ${
          kpi.urgent_assignments_count ?? 0
        } tugas ≤7h`,
      },
    ],
    [kpi, pendingIssuesTotal]
  );

  // Detailed resizable columns for Prioritas Redistribusi; clicking any row opens full diagnostic sheet
  const employeeColumns = useMemo(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Pegawai',
        size: 225,
        minSize: 150,
        maxSize: 380,
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-7 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground" title={emp.full_name}>
                  {emp.full_name}
                </span>
                {emp.employee_code && (
                  <span
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={emp.employee_code}
                  >
                    {emp.employee_code}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (row) =>
          row.department
            ? `${row.department.code || ''} ${row.department.name || ''}`.trim()
            : '-',
        id: 'department',
        header: 'Departemen',
        size: 165,
        minSize: 110,
        maxSize: 280,
        cell: ({ row }) => {
          const dept = row.original.department;
          const deptTitle = dept ? [dept.code, dept.name].filter(Boolean).join(' · ') : '-';
          return (
            <div className="flex min-w-0 items-center gap-1.5" title={deptTitle}>
              {dept?.code && (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {dept.code}
                </span>
              )}
              <span className="truncate text-xs font-medium text-foreground">
                {dept?.name || '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'position_title',
        header: 'Jabatan',
        size: 195,
        minSize: 125,
        maxSize: 320,
        cell: ({ row }) => {
          const title = row.original.position_title || '-';
          return (
            <span className="block truncate text-xs text-muted-foreground" title={title}>
              {title}
            </span>
          );
        },
      },
      {
        accessorKey: 'weekly_hours_total',
        header: 'Jam Mingguan',
        size: 135,
        minSize: 105,
        maxSize: 200,
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
              {formatScore(emp.weekly_hours_total, 1)} / {formatScore(emp.normal_weekly_hours, 0)}j
            </span>
          );
        },
      },
      {
        accessorKey: 'overtime_hours_total',
        header: 'Lembur',
        size: 105,
        minSize: 84,
        maxSize: 160,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatScore(row.original.overtime_hours_total, 1)}j
          </span>
        ),
      },
      {
        accessorKey: 'active_assignments_count',
        header: 'Tugas Aktif',
        size: 115,
        minSize: 90,
        maxSize: 170,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {row.original.active_assignments_count ?? 0} tugas
          </span>
        ),
      },
      {
        accessorKey: 'final_score',
        header: 'Skor Akhir',
        size: 105,
        minSize: 84,
        maxSize: 150,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-semibold text-foreground whitespace-nowrap tabular-nums">
            {formatScore(row.original.final_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'risk_category',
        header: 'Kategori Risiko',
        size: 160,
        minSize: 120,
        maxSize: 220,
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <StatusBadge
              status={emp.is_overridden ? 'override' : emp.risk_category}
            />
          );
        },
      },
    ],
    []
  );

  return (
    <AppShell title="Kondisi Kerja Tim" breadcrumb="Analitik">
      <div className="flex flex-col gap-6">
        {/* Top Greeting & Compact Filter Row (HRDashboard Home - V1) */}
        <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">
              Halo, {greetingName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="size-3.5 text-primary" />
                <span>
                  {formatDate(activeFiltersMeta.week_start)} s.d.{' '}
                  {formatDate(activeFiltersMeta.week_end)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={departmentFilter || ALL_VALUE}
              onValueChange={(val) => setDepartmentFilter(val === ALL_VALUE ? '' : val)}
            >
              <SelectTrigger
                id="mgr-dept-filter"
                size="sm"
                className="h-9 w-48 rounded-xl bg-card text-xs"
              >
                <SelectValue placeholder="Semua Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {dept.code}
                        </span>
                        <span>{dept.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <MonthPicker
              id="mgr-period-month"
              size="sm"
              value={periodMonth || activeFiltersMeta.period_month || ''}
              onChange={setPeriodMonth}
              clearable={Boolean(periodMonth)}
              placeholder="Pilih bulan"
              ariaLabel="Filter periode bulan"
              className="w-44"
            />

            <AnimatePresence initial={false}>
              {hasActiveFilters && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                >
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RotateCcw data-icon="inline-start" />
                    Reset
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Error State */}
        {errorMsg && (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-danger-border bg-card p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Gagal Memuat Kondisi Kerja Tim
                </h3>
                <p className="text-xs text-muted-foreground">{errorMsg}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadDashboard}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Initial Loading Skeleton matching HeroBentoCard + 8/4 Split */}
        {loading && !dashboard && !errorMsg && (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-[340px] w-full rounded-2xl" />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Skeleton className="h-96 rounded-2xl xl:col-span-8" />
              <Skeleton className="h-96 rounded-2xl xl:col-span-4" />
            </div>
          </div>
        )}

        {/* Success State */}
        {!errorMsg && dashboard && (
          <>
            {/* Band 1: Hero Bento Card (2x2 Divided KPIs + Department Performance Chart) */}
            <HeroBentoCard
              metrics={heroMetrics}
              chartTitle="Perbandingan Departemen"
              chartSubtitle={`Ringkasan ${departmentComparison.length} departemen · ${formatMonth(
                activeFiltersMeta.period_month
              )}`}
              chartLegend={
                deptView === 'chart' && deptChartData.length > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[var(--chart-2)]" />
                      Decent Work
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[var(--chart-3)]" />
                      Workload Risk
                    </span>
                  </>
                ) : null
              }
              chartActions={
                <Tabs value={deptView} onValueChange={setDeptView}>
                  <TabsList className="h-8 rounded-xl">
                    <TabsTrigger value="chart" className="rounded-lg px-2.5 text-xs">
                      Grafik
                    </TabsTrigger>
                    <TabsTrigger value="breakdown" className="rounded-lg px-2.5 text-xs">
                      Rincian ({departmentComparison.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              {deptView === 'chart' ? (
                deptChartData.length === 0 ? (
                  <p className="py-16 text-center text-xs text-muted-foreground">
                    Belum ada data departemen pada filter ini.
                  </p>
                ) : deptChartData.length >= 2 ? (
                  <PerformanceLineChart
                    data={deptChartData}
                    xKey="code"
                    heightClass="h-60"
                  />
                ) : (
                  <ChartContainer
                    config={DEPT_CHART_CONFIG}
                    className="h-60 w-full aspect-auto"
                  >
                    <BarChart
                      data={deptChartData}
                      margin={{ top: 10, right: 12, left: -14, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="code"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
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
                        radius={[8, 8, 0, 0]}
                        maxBarSize={44}
                        isAnimationActive={!prefersReducedMotion}
                        animationDuration={220}
                      />
                      <Bar
                        dataKey="avg_workload_risk_score"
                        fill="var(--color-avg_workload_risk_score)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={44}
                        isAnimationActive={!prefersReducedMotion}
                        animationDuration={220}
                      />
                    </BarChart>
                  </ChartContainer>
                )
              ) : departmentComparison.length === 0 ? (
                <p className="py-16 text-center text-xs text-muted-foreground">
                  Belum ada data departemen pada filter ini.
                </p>
              ) : (
                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {departmentComparison.map((dept) => (
                    <div
                      key={dept.department_id}
                      className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-hover-surface"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                            {dept.code}
                          </span>
                          <TruncatedText
                            text={dept.name}
                            className="text-sm font-medium text-foreground"
                          />
                        </div>
                        <StatusBadge
                          status={dept.status_category}
                          label={`Skor ${formatScore(dept.decent_work_score, 1)}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {dept.active_employees_count} pegawai · Risiko{' '}
                        {formatScore(dept.avg_workload_risk_score, 1)} ·{' '}
                        {dept.open_issues_count + dept.in_progress_issues_count} isu aktif
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </HeroBentoCard>

            {/* Band 2: Bottom 8/4 Split (Prioritas Redistribusi Table | Decent Work Donut + NFR-02 Survey) */}
            <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <DataTable
                  title="Prioritas Redistribusi"
                  countLabel="pegawai"
                  columns={employeeColumns}
                  data={filteredEmployeePriorities}
                  loading={loading}
                  searchValue={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Cari nama atau jabatan..."
                  pageSize={8}
                  onRowClick={(emp) => setSelectedEmployee(emp)}
                  emptyTitle="Tidak ada pegawai sesuai filter"
                  emptyDescription="Ubah pilihan risiko atau kata kunci pencarian."
                  actionsSlot={
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <Link to={`${routePrefix}/workload-risk`}>
                        Matriks Risiko
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  }
                  filterSlot={
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger
                        id="mgr-risk-filter"
                        size="sm"
                        className="h-9 w-40 rounded-xl bg-background text-xs"
                      >
                        <SelectValue placeholder="Semua Risiko" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={ALL_VALUE}>Semua Risiko</SelectItem>
                          <SelectItem value="high">Risiko Tinggi</SelectItem>
                          <SelectItem value="medium">Risiko Sedang</SelectItem>
                          <SelectItem value="low">Risiko Rendah</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  }
                />
              </div>

              <div className="flex flex-col gap-6 xl:col-span-4">
                {/* Decent Work Donut + 6 Dimensions Card */}
                <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold tracking-[-0.02em] text-foreground">
                      Decent Work Score
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {formatMonth(activeFiltersMeta.period_month)}
                    </span>
                  </div>

                  <DecentWorkDonutChart
                    score={kpi.decent_work_score}
                    category={kpi.decent_work_category}
                  />

                  <Separator />

                  <div className="flex flex-col gap-3.5">
                    {dimensions.map((dim) => (
                      <div key={dim.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium text-foreground">
                              {dim.label}
                            </span>
                            {dim.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`Info ${dim.label}`}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Info className="size-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  {dim.description}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <span className="font-semibold text-foreground tabular-nums">
                            {formatScore(dim.score, 1)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, Math.max(0, Number(dim.score || 0)))}
                          className="h-1.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggregated Survey Card (Strict NFR-02 Privacy: AVG & COUNT only) */}
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold tracking-[-0.02em] text-foreground">
                      Survei Agregat
                    </h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                          <span>NFR-02</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        Privasi NFR-02: Hanya agregat departemen (AVG &amp; COUNT), tanpa data individu.
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border text-center">
                    <div className="px-2">
                      <p className="text-xs text-muted-foreground">Skor WLB</p>
                      <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                        {surveySummary.avg_wlb_score != null
                          ? `${surveySummary.avg_wlb_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-muted-foreground">Beban</p>
                      <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                        {surveySummary.avg_workload_perception_score != null
                          ? `${surveySummary.avg_workload_perception_score}/5`
                          : '-'}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-muted-foreground">Partisipasi</p>
                      <p className="mt-1 text-lg font-bold text-success tabular-nums">
                        {formatScore(surveySummary.participation_rate, 0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Band 3: Compact Actionable Row (Prioritas Tim & Masalah Kerja) */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-7">
                <div className="border-b border-border px-6 py-4">
                  <h3 className="text-base font-bold tracking-[-0.02em] text-foreground">
                    Prioritas Tim
                  </h3>
                </div>

                <div className="flex-1 divide-y divide-border">
                  {priorityHighlights.map((item) => {
                    const sev = SEVERITY_TONES[item.severity] || SEVERITY_TONES.info;
                    return (
                      <Link
                        key={item.id}
                        to={resolveContextualRoute(item.action_route)}
                        className="group flex flex-col gap-1.5 px-6 py-4 transition-all duration-150 hover:bg-hover-surface hover:shadow-[inset_3px_0_0_var(--primary)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <TruncatedText
                            text={item.title}
                            className="text-sm font-semibold text-foreground group-hover:text-primary"
                          />
                          <StatusBadge tone={sev.tone} label={sev.label} />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <TruncatedText
                            as="p"
                            text={item.description}
                            className="text-xs text-muted-foreground"
                          />
                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-5">
                <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
                  <h3 className="text-base font-bold tracking-[-0.02em] text-foreground">
                    Masalah Kerja
                  </h3>
                  <span className="text-xs font-semibold text-success tabular-nums">
                    {formatScore(issuesSummary.counts.resolution_rate, 0)}% selesai
                  </span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-border border-b border-border py-3.5 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Menunggu</p>
                    <p className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                      {issuesSummary.counts.open}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ditangani</p>
                    <p className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                      {issuesSummary.counts.in_progress}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Selesai</p>
                    <p className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                      {issuesSummary.counts.resolved}
                    </p>
                  </div>
                </div>

                <div className="max-h-72 flex-1 divide-y divide-border overflow-y-auto">
                  {issuesSummary.active_issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                      <CheckCircle2 className="size-5 text-success" />
                      <p className="text-xs font-medium text-foreground">
                        Tidak ada masalah aktif
                      </p>
                    </div>
                  ) : (
                    issuesSummary.active_issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex flex-col gap-1 px-6 py-3.5 transition-colors hover:bg-hover-surface/70"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <TruncatedText
                            text={issue.category}
                            className="text-xs font-semibold text-foreground"
                          />
                          <StatusBadge status={issue.status} />
                        </div>
                        <TruncatedText
                          as="p"
                          text={`${issue.reporter?.full_name || '-'} · ${issue.department?.code || '-'}`}
                          className="text-xs text-muted-foreground"
                        >
                          {issue.reporter?.full_name || '-'} ·{' '}
                          <span className="font-mono">{issue.department?.code || '-'}</span>
                        </TruncatedText>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-border p-4">
                  <Button variant="outline" size="sm" className="w-full rounded-xl" asChild>
                    <Link to={`${routePrefix}/workplace-issues`}>
                      Kelola Masalah
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Employee 360 Workload Sub-Indicators Slide-Over Sheet */}
      <FormSheet
        open={Boolean(selectedEmployee)}
        onOpenChange={(open) => !open && setSelectedEmployee(null)}
        title="Rincian Sub-Indikator"
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
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedEmployee(null)}
            >
              Tutup
            </Button>
            <Button variant="cta" className="rounded-xl" asChild>
              <Link to={`${routePrefix}/task-assignments`}>
                Kelola Penugasan
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      >
        {selectedEmployee && (
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Skor Workload Risk</span>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={Number(selectedEmployee.final_score || 0)}
                    decimals={1}
                    className="text-3xl leading-none font-bold tracking-[-0.03em] text-foreground"
                  />
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={selectedEmployee.risk_category} />
                {selectedEmployee.is_overridden && (
                  <StatusBadge status="override" showDot={false} />
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Jabatan</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {selectedEmployee.position_title || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tugas Aktif</dt>
                <dd className="mt-0.5 font-medium text-foreground tabular-nums">
                  {selectedEmployee.active_assignments_count} tugas (lewat{' '}
                  {selectedEmployee.overdue_assignments_count})
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-4">
              {[
                {
                  label: 'Waktu Kerja Mingguan',
                  score: selectedEmployee.weekly_hours_score,
                  note: `${formatScore(selectedEmployee.weekly_hours_total, 1)}j aktual (sehat ≤ 40j · kritis ≥ 55j)`,
                },
                {
                  label: 'Lembur',
                  score: selectedEmployee.overtime_score,
                  note: `${selectedEmployee.overtime_days_count} hari · total ${formatScore(
                    selectedEmployee.overtime_hours_total,
                    1
                  )}j (maks harian ${formatScore(selectedEmployee.max_daily_overtime_hours, 1)}j)`,
                },
                {
                  label: 'Beban Tugas vs Kapasitas',
                  score: selectedEmployee.task_load_score,
                  note: `Tugas ${formatScore(
                    selectedEmployee.active_estimated_hours,
                    1
                  )}j / kapasitas ${formatScore(
                    selectedEmployee.available_capacity_hours,
                    1
                  )}j (cuti ${formatScore(selectedEmployee.approved_leave_hours, 1)}j)`,
                },
                {
                  label: 'Tekanan Tenggat',
                  score: selectedEmployee.deadline_pressure_score,
                  note: `${selectedEmployee.urgent_assignments_count} dari ${selectedEmployee.active_assignments_count} tugas aktif tenggat ≤ 7h`,
                },
              ].map((sub) => (
                <div key={sub.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{sub.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatScore(sub.score, 1)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, Number(sub.score || 0)))}
                    className="h-1.5"
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">{sub.note}</p>
                </div>
              ))}
            </div>

            <Separator />

            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Catatan: </strong>
              {selectedEmployee.priority_reason}
            </p>
          </div>
        )}
      </FormSheet>
    </AppShell>
  );
}
