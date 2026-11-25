import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Info,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatDate, formatWeek, formatWeekStart } from '@/lib/format';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { workloadRiskService } from '@/services/workloadRiskService';
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
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AnimatedNumber,
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
  WeekPicker,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const SUB_CHART_CONFIG = {
  score: { label: 'Skor Sub-Indikator', color: 'var(--chart-1)' },
};

function formatNumber(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
}

function getScoreBarFill(score) {
  const num = Number(score || 0);
  if (num >= 70) return 'var(--chart-5)';
  if (num >= 40) return 'var(--chart-3)';
  return 'var(--chart-2)';
}

export default function WorkloadRiskPage() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isEmployee = user?.role === 'employee';
  const canRecalculate = user?.role === 'manager' || user?.role === 'admin';
  const routePrefix =
    user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/employee';

  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState({});
  const [thresholds, setThresholds] = useState({});
  const [departments, setDepartments] = useState([]);
  const [filtersMeta, setFiltersMeta] = useState({});

  // Interactive Filters (Unified Select Controls, zero filter badges)
  const [periodWeek, setPeriodWeek] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [riskCategory, setRiskCategory] = useState(ALL_VALUE);
  const [overrideFilter, setOverrideFilter] = useState(ALL_VALUE);
  const [search, setSearch] = useState('');

  // Diagnostic Slide-Over Sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await workloadRiskService.getWorkloadRisks({
        period_week: periodWeek,
        department_id: departmentFilter,
        risk_category: riskCategory === ALL_VALUE ? '' : riskCategory,
        is_overridden: overrideFilter === 'override' ? '1' : '',
        search: search.trim(),
      });

      setRisks(data?.workload_risks || []);
      setSummary(data?.summary || {});
      setThresholds(data?.thresholds || {});
      setDepartments(data?.departments || []);
      setFiltersMeta(data?.filters || {});
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data Workload Risk.').message);
    } finally {
      setLoading(false);
    }
  }, [periodWeek, departmentFilter, riskCategory, overrideFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRefetchOnFocus(loadData);

  const handleRecalculate = async () => {
    if (!canRecalculate) return;
    setRecalculating(true);
    try {
      const res = await workloadRiskService.recalculateWorkloadRisks({
        period_week: periodWeek || filtersMeta.period_week || '',
        department_id: departmentFilter,
      });
      const count = res?.data?.recalculated_count ?? 0;
      toast.success(
        res?.message || `Kalkulasi ulang tersimpan untuk ${count} pegawai aktif.`
      );
      await loadData();
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal menghitung ulang Workload Risk.').message);
    } finally {
      setRecalculating(false);
    }
  };

  const openDetailSheet = useCallback(async (row) => {
    setSelectedRisk(row);
    setDetailSheetOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workloadRiskService.getWorkloadRisk(row.id);
      setSelectedRisk(fresh);
    } catch {
      // Keep snapshot if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        periodWeek ||
          departmentFilter ||
          riskCategory !== ALL_VALUE ||
          overrideFilter !== ALL_VALUE ||
          search.trim()
      ),
    [periodWeek, departmentFilter, riskCategory, overrideFilter, search]
  );

  const resetFilters = () => {
    setPeriodWeek('');
    setDepartmentFilter('');
    setRiskCategory(ALL_VALUE);
    setOverrideFilter(ALL_VALUE);
    setSearch('');
  };

  const avgFinal = Number(summary.avg_final_score || 0);
  const avgCategory =
    (summary.overridden_count ?? 0) > 0 || avgFinal >= 70
      ? 'high'
      : avgFinal >= 40
        ? 'medium'
        : 'low';

  const subIndicatorBars = useMemo(
    () => [
      {
        key: 'weekly_hours',
        shortLabel: 'Waktu Kerja',
        label: 'Waktu Kerja Mingguan',
        score: Number(Number(summary.avg_weekly_hours_score || 0).toFixed(1)),
        hint: `Ambang ${thresholds.normal_weekly_hours_threshold ?? 40}j – ${
          thresholds.critical_weekly_hours_threshold ?? 55
        }j`,
      },
      {
        key: 'overtime',
        shortLabel: 'Lembur',
        label: 'Lembur',
        score: Number(Number(summary.avg_overtime_score || 0).toFixed(1)),
        hint: `Batas ${thresholds.max_daily_overtime_hours ?? 4}j/hari · ${
          thresholds.max_weekly_overtime_hours ?? 18
        }j/minggu`,
      },
      {
        key: 'task_load',
        shortLabel: 'Beban Tugas',
        label: 'Beban Tugas vs Kapasitas',
        score: Number(Number(summary.avg_task_load_score || 0).toFixed(1)),
        hint: `Rasio ${thresholds.task_load_safe_ratio ?? 1.0} – ${
          thresholds.task_load_max_ratio ?? 1.5
        } kapasitas efektif`,
      },
      {
        key: 'deadline_pressure',
        shortLabel: 'Tenggat',
        label: 'Tekanan Tenggat',
        score: Number(Number(summary.avg_deadline_pressure_score || 0).toFixed(1)),
        hint: `Tugas jatuh tempo ≤ ${thresholds.deadline_window_days ?? 7} hari`,
      },
    ],
    [summary, thresholds]
  );

  // Detailed resizable columns for Matriks Risiko Pegawai / Riwayat Risiko; clicking any row opens diagnostic sheet
  const columns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'period_week',
        header: 'Periode Minggu',
        size: 190,
        minSize: 140,
        maxSize: 270,
        cell: ({ row }) => {
          const weekLabel = formatWeek(row.original.period_week);
          return (
            <span
              className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums"
              title={weekLabel}
            >
              {weekLabel}
            </span>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.metrics?.weekly_hours_total || 0),
        id: 'weekly_hours',
        header: 'Jam Aktual',
        size: 130,
        minSize: 100,
        maxSize: 195,
        cell: ({ row }) => {
          const m = row.original.metrics || {};
          return (
            <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
              {formatNumber(m.weekly_hours_total, 1)} / {formatNumber(m.normal_weekly_hours, 0)}j
            </span>
          );
        },
      },
      {
        accessorKey: 'weekly_hours_score',
        header: 'Skor Waktu',
        size: 110,
        minSize: 86,
        maxSize: 160,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatNumber(row.original.weekly_hours_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'overtime_score',
        header: 'Skor Lembur',
        size: 110,
        minSize: 86,
        maxSize: 160,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatNumber(row.original.overtime_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'task_load_score',
        header: 'Skor Beban',
        size: 110,
        minSize: 86,
        maxSize: 160,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatNumber(row.original.task_load_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'deadline_pressure_score',
        header: 'Skor Tenggat',
        size: 115,
        minSize: 88,
        maxSize: 165,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatNumber(row.original.deadline_pressure_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'final_score',
        header: 'Skor Akhir',
        size: 105,
        minSize: 84,
        maxSize: 155,
        cell: ({ row }) => (
          <span className="block truncate text-xs font-semibold text-foreground whitespace-nowrap tabular-nums">
            {formatNumber(row.original.final_score, 1)}
          </span>
        ),
      },
      {
        accessorKey: 'risk_category',
        header: 'Kategori & PP 35',
        size: 165,
        minSize: 125,
        maxSize: 225,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <StatusBadge
              status={r.is_overridden ? 'override' : r.risk_category}
            />
          );
        },
      },
    ];

    if (isEmployee) {
      return baseColumns;
    }

    return [
      {
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai',
        size: 225,
        minSize: 150,
        maxSize: 380,
        cell: ({ row }) => {
          const emp = row.original.employee || {};
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-7 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span
                  className="truncate font-medium text-foreground"
                  title={emp.full_name || '-'}
                >
                  {emp.full_name || '-'}
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
          row.employee?.department
            ? `${row.employee.department.code || ''} ${row.employee.department.name || ''}`.trim()
            : '-',
        id: 'department',
        header: 'Departemen',
        size: 165,
        minSize: 110,
        maxSize: 280,
        cell: ({ row }) => {
          const dept = row.original.employee?.department;
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
      ...baseColumns,
    ];
  }, [isEmployee]);

  return (
    <AppShell
      title={isEmployee ? 'Risiko Saya' : 'Risiko Beban Kerja'}
      breadcrumb={isEmployee ? 'Ruang Kerja' : 'Analitik'}
    >
      <div className="flex flex-col gap-8">
        {/* Band 1: 4 KPI Cards */}
        {loading && risks.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label={isEmployee ? 'Skor Risiko Saya' : 'Rata-rata Risiko Tim'}
              value={formatNumber(avgFinal, 1)}
              unit="/ 100"
              icon={Activity}
              status={avgCategory}
            />

            <KpiStatCard
              label={isEmployee ? 'Kategori Risiko' : 'Risiko Tinggi'}
              value={
                isEmployee
                  ? risks[0]?.risk_category === 'high'
                    ? 'Tinggi'
                    : risks[0]?.risk_category === 'medium'
                      ? 'Sedang'
                      : 'Rendah'
                  : (summary.high_risk_count ?? 0)
              }
              unit={isEmployee ? undefined : 'pegawai'}
              icon={ShieldAlert}
              hint={
                isEmployee
                  ? formatWeek(filtersMeta.period_week)
                  : `Dari ${summary.total_employees ?? 0} pegawai aktif`
              }
            />

            <KpiStatCard
              label="Override PP 35/2021"
              value={summary.overridden_count ?? 0}
              unit="kasus"
              icon={AlertTriangle}
              status={(summary.overridden_count ?? 0) > 0 ? 'danger' : 'info'}
              statusLabel={(summary.overridden_count ?? 0) > 0 ? 'Redistribusi' : 'Terkendali'}
            />

            <KpiStatCard
              label={isEmployee ? 'Jam Aktual / Estimasi' : 'Sedang / Rendah'}
              value={
                isEmployee
                  ? `${formatNumber(summary.total_weekly_hours, 1)}j`
                  : `${summary.medium_risk_count ?? 0} / ${summary.low_risk_count ?? 0}`
              }
              unit={
                isEmployee
                  ? `/ ${formatNumber(summary.total_active_estimated_hours, 0)}j`
                  : 'pegawai'
              }
              icon={Users}
              hint={isEmployee ? 'Log minggu ini' : 'Skor 40–69 · < 40'}
            />
          </section>
        )}

        {/* Band 2: Sub-Indicators Chart + Open Spaced Breakdown */}
        {!errorMsg && (
          <section className="grid grid-cols-1 gap-8 rounded-2xl border border-border bg-card p-6 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-bold tracking-[-0.02em] text-foreground">
                    {isEmployee ? 'Sub-Indikator Saya' : 'Rata-rata Sub-Indikator'}
                  </h2>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(filtersMeta.week_start)} s.d. {formatDate(filtersMeta.week_end)}
                  </p>
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Info className="size-3.5" />
                      <span>PP 35/2021</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    Non-punitif · bobot 25% per sub-indikator. Jam ≥ 55j/mg atau lembur &gt; 4j/hr / &gt; 18j/mg otomatis memicu Override Risiko Tinggi.
                  </TooltipContent>
                </Tooltip>
              </div>

              {loading && risks.length === 0 ? (
                <Skeleton className="h-52 w-full rounded-xl" />
              ) : (
                <ChartContainer
                  config={SUB_CHART_CONFIG}
                  className="h-52 w-full aspect-auto"
                >
                  <BarChart
                    data={subIndicatorBars}
                    margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="shortLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={70}
                      stroke="var(--chart-5)"
                      strokeDasharray="4 4"
                      strokeWidth={1.25}
                    />
                    <Bar
                      dataKey="score"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={42}
                      isAnimationActive={!prefersReducedMotion}
                      animationDuration={220}
                    >
                      {subIndicatorBars.map((entry) => (
                        <Cell key={entry.key} fill={getScoreBarFill(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            <div className="grid grid-cols-1 content-center gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-2 lg:col-span-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              {subIndicatorBars.map((bar) => (
                <div key={bar.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{bar.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatNumber(bar.score, 1)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, bar.score))} className="h-1.5" />
                  <p className="text-xs text-muted-foreground tabular-nums">{bar.hint}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Band 3: Workload Risk DataTable */}
        <DataTable
          title={isEmployee ? 'Riwayat Risiko' : 'Matriks Risiko Pegawai'}
          countLabel="rekaman"
          columns={columns}
          data={risks}
          loading={loading}
          error={errorMsg}
          onRetry={loadData}
          searchable={!isEmployee}
          searchValue={search}
          onSearchChange={isEmployee ? undefined : setSearch}
          searchPlaceholder="Cari nama atau kode..."
          pageSize={10}
          onRowClick={(row) => openDetailSheet(row)}
          emptyTitle={
            hasActiveFilters ? 'Tidak ada data sesuai filter' : 'Belum ada data analisis'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Sesuaikan minggu, departemen, atau filter risiko.'
              : 'Jalankan kalkulasi untuk memproses beban kerja minggu ini.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              {canRecalculate && (
                <Button
                  variant="cta"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                >
                  <Calculator data-icon="inline-start" />
                  Hitung Ulang
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <WeekPicker
                id="wr-period-week"
                size="sm"
                value={periodWeek || filtersMeta.period_week || ''}
                onChange={setPeriodWeek}
                clearable={Boolean(periodWeek)}
                placeholder="Pilih minggu"
                ariaLabel="Pilih minggu periode"
                className="w-60"
              />

              {!isEmployee && (
                <>
                  <Select
                    value={departmentFilter || ALL_VALUE}
                    onValueChange={(val) =>
                      setDepartmentFilter(val === ALL_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger id="wr-dept-filter" size="sm" className="h-9 w-44 rounded-xl bg-background text-xs">
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

                  <Select value={riskCategory} onValueChange={setRiskCategory}>
                    <SelectTrigger id="wr-risk-filter" size="sm" className="h-9 w-36 rounded-xl bg-background text-xs">
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

                  <Select value={overrideFilter} onValueChange={setOverrideFilter}>
                    <SelectTrigger id="wr-override-filter" size="sm" className="h-9 w-40 rounded-xl bg-background text-xs">
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                        <SelectItem value="override">Override PP 35</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </>
              )}

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
          }
          actionsSlot={
            canRecalculate ? (
              <Button
                variant="cta"
                size="sm"
                className="rounded-xl"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                {recalculating ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Calculator data-icon="inline-start" />
                )}
                {recalculating ? 'Menghitung...' : 'Hitung Ulang'}
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Diagnostic Slide-Over Sheet */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedRisk)}
        onOpenChange={(open) => setDetailSheetOpen(open)}
        title={
          selectedRisk
            ? `Diagnostik Risiko · ${formatWeekStart(selectedRisk.period_week)}`
            : 'Diagnostik'
        }
        description={
          selectedRisk
            ? `${selectedRisk.employee?.full_name || '-'} (${
                selectedRisk.employee?.employee_code || '-'
              }) · ${selectedRisk.employee?.department?.name || '-'}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDetailSheetOpen(false)}
            >
              Tutup
            </Button>
            <Button variant="cta" className="rounded-xl" asChild>
              <Link
                to={isEmployee ? `${routePrefix}/work-logs` : `${routePrefix}/task-assignments`}
              >
                {isEmployee ? 'Buka Log Kerja' : 'Kelola Penugasan'}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      >
        {selectedRisk && (
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Periode {formatWeek(selectedRisk.period_week)}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={Number(selectedRisk.final_score || 0)}
                    decimals={2}
                    className="text-3xl leading-none font-semibold tracking-[-0.03em] text-foreground"
                  />
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={selectedRisk.risk_category} />
                {selectedRisk.is_overridden && (
                  <StatusBadge status="override" showDot={false} />
                )}
              </div>
            </div>

            {selectedRisk.override_reasons?.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-danger-border bg-danger-subtle p-3.5 text-xs text-danger">
                <p className="font-medium">Pemicu Override PP No. 35/2021:</p>
                <ul className="list-disc pl-4">
                  {selectedRisk.override_reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {[
                {
                  label: 'Waktu Kerja Mingguan',
                  score: selectedRisk.weekly_hours_score,
                  note: `${formatNumber(
                    selectedRisk.metrics?.weekly_hours_total,
                    1
                  )}j tercatat (normal ≤ 40j · kritis ≥ 55j)`,
                },
                {
                  label: 'Lembur',
                  score: selectedRisk.overtime_score,
                  note: `${formatNumber(selectedRisk.metrics?.overtime_hours_total, 1)}j · ${
                    selectedRisk.metrics?.overtime_days_count ?? 0
                  } hari (${
                    selectedRisk.metrics?.overtime_source === 'approved_overtimes'
                      ? 'lembur disetujui'
                      : `log > ${selectedRisk.metrics?.normal_daily_hours ?? 8}j/hr`
                  })`,
                },
                {
                  label: 'Beban Tugas vs Kapasitas',
                  score: selectedRisk.task_load_score,
                  note: `Estimasi ${formatNumber(
                    selectedRisk.metrics?.active_estimated_hours,
                    1
                  )}j / kapasitas ${formatNumber(
                    selectedRisk.metrics?.available_capacity_hours,
                    1
                  )}j`,
                },
                {
                  label: 'Tekanan Tenggat',
                  score: selectedRisk.deadline_pressure_score,
                  note: `${selectedRisk.metrics?.urgent_assignments_count ?? 0} dari ${
                    selectedRisk.metrics?.active_assignments_count ?? 0
                  } tugas jatuh tempo ≤ 7h`,
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatNumber(item.score, 2)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, Number(item.score || 0)))}
                    className="h-1.5"
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">{item.note}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Penugasan Aktif</span>
                {Array.isArray(selectedRisk.active_assignments) && (
                  <span className="text-muted-foreground tabular-nums">
                    {selectedRisk.active_assignments.length} tugas
                  </span>
                )}
              </div>

              {detailLoading && !Array.isArray(selectedRisk.active_assignments) ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ) : !selectedRisk.active_assignments?.length ? (
                <p className="text-xs text-muted-foreground">Tidak ada penugasan aktif.</p>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {selectedRisk.active_assignments.map((assign) => (
                    <div
                      key={assign.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-hover-surface/70"
                    >
                      <span className="truncate font-medium text-foreground">
                        {assign.task?.title || `Penugasan #${assign.id}`}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatNumber(assign.task?.estimated_hours, 1)}j ·{' '}
                        {formatDate(assign.deadline)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Rekomendasi: </strong>
              {selectedRisk.recommendation_note}
            </p>
          </div>
        )}
      </FormSheet>
    </AppShell>
  );
}
