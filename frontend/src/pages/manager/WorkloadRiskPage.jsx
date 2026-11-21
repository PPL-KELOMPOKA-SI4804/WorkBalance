import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Clock,
  Eye,
  RefreshCw,
  RotateCcw,
  Scale,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

const ALL_DEPARTMENTS_VALUE = '__all__';

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

  // Interactive Filters
  const [periodWeek, setPeriodWeek] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [riskCategory, setRiskCategory] = useState('all');
  const [overrideOnly, setOverrideOnly] = useState(false);
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
        risk_category: riskCategory === 'all' ? '' : riskCategory,
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
      toast.success(
        res?.message || `Kalkulasi ulang berhasil disimpan untuk ${count} pegawai aktif.`
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
      // Keep row snapshot if detail refresh fails
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        periodWeek ||
          departmentFilter ||
          (riskCategory && riskCategory !== 'all') ||
          overrideOnly ||
          search.trim()
      ),
    [periodWeek, departmentFilter, riskCategory, overrideOnly, search]
  );

  const resetFilters = () => {
    setPeriodWeek('');
    setDepartmentFilter('');
    setRiskCategory('all');
    setOverrideOnly(false);
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
        label: '1. Waktu Kerja Mingguan',
        score: Number(Number(summary.avg_weekly_hours_score || 0).toFixed(1)),
        hint: `Interpolasi ${thresholds.normal_weekly_hours_threshold ?? 40}j (0) s.d. ${
          thresholds.critical_weekly_hours_threshold ?? 55
        }j (100)`,
      },
      {
        key: 'overtime',
        shortLabel: 'Lembur',
        label: '2. Lembur',
        score: Number(Number(summary.avg_overtime_score || 0).toFixed(1)),
        hint: `Adaptif 8j (5hk) / 7j (6hk); > ${thresholds.max_daily_overtime_hours ?? 4}j/hr atau > ${
          thresholds.max_weekly_overtime_hours ?? 18
        }j/mg -> 100`,
      },
      {
        key: 'task_load',
        shortLabel: 'Beban Tugas',
        label: '3. Beban Tugas vs Kapasitas',
        score: Number(Number(summary.avg_task_load_score || 0).toFixed(1)),
        hint: `Rasio estimasi terhadap kapasitas (40j − cuti): ${thresholds.task_load_safe_ratio ?? 1.0} s.d. ${
          thresholds.task_load_max_ratio ?? 1.5
        }`,
      },
      {
        key: 'deadline_pressure',
        shortLabel: 'Tenggat',
        label: '4. Tekanan Tenggat',
        score: Number(Number(summary.avg_deadline_pressure_score || 0).toFixed(1)),
        hint: `Persentase penugasan aktif jatuh tempo ≤ ${
          thresholds.deadline_window_days ?? 7
        } hari atau lewat tenggat`,
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
                <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                  {getInitials(emp.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {emp.full_name || '-'}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{emp.employee_code || '-'}</span>
                  {emp.department?.code ? ` · ${emp.department.code}` : ''}
                  {emp.position?.title ? ` · ${emp.position.title}` : ''}
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
            <div className="flex flex-col font-mono text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {formatNumber(m.weekly_hours_total, 1)} / {formatNumber(m.normal_weekly_hours, 0)}j
              </span>
              <span className="text-[11px] text-muted-foreground">
                Lmb {formatNumber(m.overtime_hours_total, 1)}j ({m.overtime_days_count ?? 0}hk)
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
              <span className="font-mono font-medium text-foreground">
                {formatNumber(m.active_estimated_hours, 1)}j /{' '}
                {formatNumber(m.available_capacity_hours, 0)}j
              </span>
              <span className="text-[11px] text-muted-foreground">
                {m.active_assignments_count ?? 0} tugas · ≤7h: {m.urgent_assignments_count ?? 0}
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
            <div className="flex items-center gap-1 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums">
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground" title="Waktu Kerja">
                {formatNumber(r.weekly_hours_score, 0)}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground" title="Lembur">
                {formatNumber(r.overtime_score, 0)}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground" title="Beban Tugas">
                {formatNumber(r.task_load_score, 0)}
              </span>
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-foreground"
                title="Tekanan Tenggat"
              >
                {formatNumber(r.deadline_pressure_score, 0)}
              </span>
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
            <div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
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
          <p className="max-w-[200px] line-clamp-2 text-xs leading-snug text-muted-foreground whitespace-normal">
            {row.original.recommendation_note}
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
      title="Analisis Workload Risk"
      breadcrumb={
        isEmployee
          ? 'Analitik / Profil Risiko Pribadi'
          : 'Analitik / Kepatuhan Beban Kerja PP 35/2021'
      }
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
      <div className="flex flex-col gap-6">
        {/* Row 1: 4 KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label={isEmployee ? 'Skor Workload Risk Saya' : 'Rata-rata Workload Risk Tim'}
              value={formatNumber(avgFinal, 1)}
              unit="/ 100"
              icon={Activity}
              status={avgCategory}
              hint={filtersMeta.period_week || '-'}
            />

            <KpiStatCard
              label={isEmployee ? 'Status Kategori Risiko' : 'Pegawai Risiko Tinggi'}
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
              status={(summary.high_risk_count ?? 0) > 0 ? 'high' : 'low'}
              statusLabel={
                isEmployee
                  ? `Periode ${filtersMeta.period_week || '-'}`
                  : `Dari ${summary.total_employees ?? 0} pegawai aktif`
              }
            />

            <KpiStatCard
              label="Override Wajib PP No. 35/2021"
              value={summary.overridden_count ?? 0}
              unit="kasus"
              icon={AlertTriangle}
              status={(summary.overridden_count ?? 0) > 0 ? 'danger' : 'info'}
              statusLabel={
                (summary.overridden_count ?? 0) > 0 ? 'Perlu redistribusi segera' : 'Dalam batas'
              }
              hint="≥55j/mg atau lembur >18j"
            />

            <KpiStatCard
              label={isEmployee ? 'Jam Aktual vs Estimasi' : 'Distribusi Sedang / Rendah'}
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
              hint={isEmployee ? 'Jam log / estimasi tugas' : 'Sedang (40–69) · Rendah (<40)'}
            />
          </section>
        )}

        {/* Calm Non-Punitive Regulatory Notice */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">
              Model Pendukung Keputusan Non-Punitif (PP No. 35/2021):
            </span>{' '}
            Skor Workload Risk mendeteksi ketidakseimbangan beban tugas lebih awal — bukan penilaian
            kinerja individu. Jam kerja{' '}
            <span className="font-mono font-medium text-foreground">≥ 55j/mg</span> atau lembur{' '}
            <span className="font-mono font-medium text-foreground">&gt; 4j/hr</span> /{' '}
            <span className="font-mono font-medium text-foreground">&gt; 18j/mg</span> otomatis
            memicu status <span className="font-medium text-foreground">Risiko Tinggi (Override)</span>.
          </p>
        </div>

        {/* Row 2: Recharts 4 Sub-Indicators Profile & Dynamic Model Thresholds */}
        {!errorMsg && (
          <section className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card p-5 lg:grid-cols-12">
            <div className="flex flex-col gap-3 lg:col-span-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  {isEmployee
                    ? 'Profil 4 Sub-Indikator Anda'
                    : 'Rata-rata 4 Sub-Indikator Beban Kerja'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Bobot seimbang 25% per indikator · Rentang{' '}
                  <span className="font-mono text-foreground">
                    {filtersMeta.week_start || '-'} s.d. {filtersMeta.week_end || '-'}
                  </span>
                </p>
              </div>

              {loading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
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
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={42}>
                      {subIndicatorBars.map((entry) => (
                        <Cell key={entry.key} fill={getScoreBarFill(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:col-span-7">
              {subIndicatorBars.map((bar) => (
                <div
                  key={bar.key}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-muted/20 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{bar.label}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatNumber(bar.score, 1)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, bar.score))} className="h-1.5" />
                  <p className="text-[11px] leading-snug text-muted-foreground">{bar.hint}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Row 3: Workload Risk DataTable (TanStack Table v9) */}
        <DataTable
          title={
            isEmployee
              ? 'Riwayat & Rincian Workload Risk Saya'
              : 'Identifikasi Risiko Beban Kerja Pegawai'
          }
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
            hasActiveFilters
              ? 'Tidak ada data sesuai filter'
              : 'Belum ada data analisis Workload Risk'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Sesuaikan pilihan minggu, departemen, kategori risiko, atau kata kunci.'
              : 'Jalankan kalkulasi indikator untuk memproses jam aktual, lembur, tugas, dan tenggat pada minggu ini.'
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
                  Hitung Ulang Indikator
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
                  className="h-8 rounded-lg border border-input bg-background px-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {!isEmployee && (
                <>
                  <Select
                    value={departmentFilter || ALL_DEPARTMENTS_VALUE}
                    onValueChange={(val) =>
                      setDepartmentFilter(val === ALL_DEPARTMENTS_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger size="sm" className="w-44 bg-background text-xs">
                      <SelectValue placeholder="Semua Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_DEPARTMENTS_VALUE}>Semua Departemen</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.code} — {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <ToggleGroup
                    type="single"
                    value={riskCategory}
                    onValueChange={(val) => val && setRiskCategory(val)}
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

                  <Button
                    variant={overrideOnly ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setOverrideOnly((prev) => !prev)}
                    className="h-8 text-xs"
                  >
                    Override PP 35
                  </Button>
                </>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Reset
                </Button>
              )}
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

      {/* Diagnostic Slide-Over Sheet */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedRisk)}
        onOpenChange={(open) => setDetailSheetOpen(open)}
        title={selectedRisk ? `Diagnostik Workload Risk · ${selectedRisk.period_week}` : 'Diagnostik'}
        description={
          selectedRisk
            ? `${selectedRisk.employee?.full_name || '-'} (${
                selectedRisk.employee?.employee_code || '-'
              }) · ${selectedRisk.employee?.department?.name || '-'} · ${
                selectedRisk.employee?.employment_type?.name || '-'
              }`
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
                {isEmployee ? 'Buka Catatan Waktu Kerja' : 'Kelola Penugasan & Redistribusi'}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      >
        {selectedRisk && (
          <div className="flex flex-col gap-5">
            {detailLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                <span>Memuat rincian tugas dan catatan waktu kerja...</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Skor Akhir Rata-rata Terbobot</span>
                <span className="font-mono text-3xl font-semibold text-foreground tabular-nums">
                  {formatNumber(selectedRisk.final_score, 2)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={selectedRisk.risk_category} />
                {selectedRisk.is_overridden && (
                  <StatusBadge status="override" showDot={false} />
                )}
              </div>
            </div>

            {selectedRisk.override_reasons?.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
                <p className="font-medium">Pemicu Override PP No. 35/2021:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {selectedRisk.override_reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  label: '1. Waktu Kerja Mingguan',
                  score: selectedRisk.weekly_hours_score,
                  note: `${formatNumber(
                    selectedRisk.metrics?.weekly_hours_total,
                    1
                  )} jam tercatat minggu ini (normal ≤ 40j, kritis ≥ 55j).`,
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
                  note: `Estimasi ${formatNumber(
                    selectedRisk.metrics?.active_estimated_hours,
                    1
                  )}j · kapasitas ${formatNumber(
                    selectedRisk.metrics?.available_capacity_hours,
                    1
                  )}j (cuti disetujui: ${formatNumber(
                    selectedRisk.metrics?.approved_leave_hours,
                    1
                  )}j).`,
                },
                {
                  label: '4. Tekanan Tenggat',
                  score: selectedRisk.deadline_pressure_score,
                  note: `${selectedRisk.metrics?.urgent_assignments_count ?? 0} dari ${
                    selectedRisk.metrics?.active_assignments_count ?? 0
                  } tugas aktif jatuh tempo ≤ 7 hari / lewat tenggat.`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col gap-1.5 rounded-lg border border-border p-3.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatNumber(item.score, 2)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, Number(item.score || 0)))}
                    className="h-1.5"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>

            {Array.isArray(selectedRisk.active_assignments) && (
              <div className="flex flex-col gap-2">
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Penugasan Aktif Terkait
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedRisk.active_assignments.length} tugas
                  </span>
                </div>
                {selectedRisk.active_assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada penugasan aktif.</p>
                ) : (
                  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {selectedRisk.active_assignments.map((assign) => (
                      <div
                        key={assign.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <span className="truncate font-medium text-foreground">
                          {assign.task?.title || `Penugasan #${assign.id}`}
                        </span>
                        <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                          {formatNumber(assign.task?.estimated_hours, 1)}j · {assign.deadline}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Rekomendasi Non-Punitif: </span>
              {selectedRisk.recommendation_note}
            </div>
          </div>
        )}
      </FormSheet>
    </AppShell>
  );
}
