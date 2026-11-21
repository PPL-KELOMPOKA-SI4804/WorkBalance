import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Clock,
  Eye,
  Info,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
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

  // Interactive Filters (Unified Select Controls — zero filter badges)
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
      // Keep snapshot if detail refresh fails
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

  const columns = useMemo(
    () => [
      {
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original.employee || {};
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {emp.full_name || '-'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{emp.employee_code || '-'}</span>
                  {emp.department?.code ? (
                    <>
                      {' · '}
                      <span className="font-mono">{emp.department.code}</span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.metrics?.weekly_hours_total || 0),
        id: 'weekly_hours',
        header: 'Jam & Lembur',
        cell: ({ row }) => {
          const m = row.original.metrics || {};
          return (
            <div className="flex flex-col text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {formatNumber(m.weekly_hours_total, 1)} / {formatNumber(m.normal_weekly_hours, 0)}j
              </span>
              <span className="text-muted-foreground">
                Lembur {formatNumber(m.overtime_hours_total, 1)}j ({m.overtime_days_count ?? 0}h)
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.metrics?.active_estimated_hours || 0),
        id: 'task_load',
        header: 'Beban & Kapasitas',
        cell: ({ row }) => {
          const m = row.original.metrics || {};
          return (
            <div className="flex flex-col text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {formatNumber(m.active_estimated_hours, 1)}j /{' '}
                {formatNumber(m.available_capacity_hours, 0)}j
              </span>
              <span className="text-muted-foreground">
                {m.active_assignments_count ?? 0} tugas · ≤7h {m.urgent_assignments_count ?? 0}
              </span>
            </div>
          );
        },
      },
      {
        id: 'sub_scores',
        header: 'Sub-Skor',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
              <span title="Waktu Kerja">{formatNumber(r.weekly_hours_score, 0)}</span>
              <span className="text-border">·</span>
              <span title="Lembur">{formatNumber(r.overtime_score, 0)}</span>
              <span className="text-border">·</span>
              <span title="Beban Tugas">{formatNumber(r.task_load_score, 0)}</span>
              <span className="text-border">·</span>
              <span title="Tekanan Tenggat">{formatNumber(r.deadline_pressure_score, 0)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'final_score',
        header: 'Skor & Risiko',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
              <StatusBadge
                status={r.risk_category}
                label={`${formatNumber(r.final_score, 1)} · ${
                  r.risk_category === 'high'
                    ? 'Tinggi'
                    : r.risk_category === 'medium'
                      ? 'Sedang'
                      : 'Rendah'
                }`}
              />
              {r.is_overridden && <StatusBadge status="override" label="PP 35" showDot={false} />}
            </div>
          );
        },
      },
      {
        accessorKey: 'recommendation_note',
        header: 'Catatan',
        enableSorting: false,
        cell: ({ row }) => (
          <p className="max-w-[210px] line-clamp-2 text-xs leading-snug text-muted-foreground whitespace-normal">
            {row.original.recommendation_note}
          </p>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="-mr-1.5 flex justify-end">
            <Button
              variant="outline"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                openDetailSheet(row.original);
              }}
            >
              <Eye data-icon="inline-start" />
              Detail
            </Button>
          </div>
        ),
      },
    ],
    [openDetailSheet]
  );

  return (
    <AppShell
      title={isEmployee ? 'Risiko Saya' : 'Risiko Beban Kerja'}
      breadcrumb="Analitik"
      actions={
        canRecalculate ? (
          <Button size="sm" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Calculator data-icon="inline-start" />
            )}
            {recalculating ? 'Menghitung...' : 'Hitung Ulang'}
          </Button>
        ) : undefined
      }
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
                  ? `Minggu ${filtersMeta.period_week || '-'}`
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

        {/* Band 2: Sub-Indicators Chart + Open Spaced Breakdown (zero nested cards!) */}
        {!errorMsg && (
          <section className="grid grid-cols-1 gap-8 rounded-2xl border border-border bg-card p-6 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                    {isEmployee ? 'Sub-Indikator Saya' : 'Rata-rata Sub-Indikator'}
                  </h2>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {filtersMeta.week_start || '-'} s.d. {filtersMeta.week_end || '-'}
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
                      animationDuration={320}
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

        {/* Band 3: Workload Risk DataTable (Unified Single-Row Select Filters) */}
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
                <Button size="sm" onClick={handleRecalculate} disabled={recalculating}>
                  <Calculator data-icon="inline-start" />
                  Hitung Ulang
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <input
                  id="wr-period-week"
                  name="period_week"
                  type="week"
                  value={periodWeek || filtersMeta.period_week || ''}
                  onChange={(e) => setPeriodWeek(e.target.value)}
                  aria-label="Pilih minggu periode"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {!isEmployee && (
                <>
                  <Select
                    value={departmentFilter || ALL_VALUE}
                    onValueChange={(val) =>
                      setDepartmentFilter(val === ALL_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger id="wr-dept-filter" size="sm" className="w-44 bg-background text-xs">
                      <SelectValue placeholder="Semua Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.code} — {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select value={riskCategory} onValueChange={setRiskCategory}>
                    <SelectTrigger id="wr-risk-filter" size="sm" className="w-36 bg-background text-xs">
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
                    <SelectTrigger id="wr-override-filter" size="sm" className="w-40 bg-background text-xs">
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
            <Button
              variant="outline"
              size="icon-sm"
              onClick={loadData}
              aria-label="Muat ulang data"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          }
        />
      </div>

      {/* Diagnostic Slide-Over Sheet (Open spacing + native Skeleton loading) */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedRisk)}
        onOpenChange={(open) => setDetailSheetOpen(open)}
        title={selectedRisk ? `Diagnostik Risiko · ${selectedRisk.period_week}` : 'Diagnostik'}
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
            <Button variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Tutup
            </Button>
            <Button asChild>
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
                <span className="text-xs text-muted-foreground">Skor Akhir</span>
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
              <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
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
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <span className="truncate font-medium text-foreground">
                        {assign.task?.title || `Penugasan #${assign.id}`}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatNumber(assign.task?.estimated_hours, 1)}j · {assign.deadline}
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
