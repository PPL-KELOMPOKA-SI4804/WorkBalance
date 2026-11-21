import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Award,
  Briefcase,
  Building2,
  ClipboardCheck,
  Clock,
  HeartHandshake,
  MessageSquareWarning,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import {
  daysUntilDate,
  formatDate,
  formatWeek,
  toApiDate,
  toISODateLocal,
} from '@/lib/format';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { surveyService } from '@/services/surveyService';
import { taskAssignmentService } from '@/services/taskAssignmentService';
import { trainingParticipationService } from '@/services/trainingParticipationService';
import { workloadRiskService } from '@/services/workloadRiskService';
import { workLogService } from '@/services/workLogService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  DataTable,
  DatePicker,
  FormSheet,
  KpiStatCard,
  StatusBadge,
  WorkHoursBarChart,
} from '@/components/workbalance';

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const NO_ASSIGNMENT_VALUE = '__none__';

function formatScore(val, digits = 1) {
  return Number(val || 0).toFixed(digits);
}

function getDeadlineBadge(deadlineStr, status) {
  if (!deadlineStr || status === 'completed') return null;
  const diffDays = daysUntilDate(deadlineStr);
  if (diffDays === null) return null;
  if (diffDays < 0) return { tone: 'danger', label: `Lewat ${Math.abs(diffDays)}h` };
  if (diffDays === 0) return { tone: 'warning', label: 'Hari ini' };
  if (diffDays <= 7) return { tone: 'warning', label: `H-${diffDays}` };
  return null;
}

function buildRecentDailyChartData(workLogs = [], dailyLimit = 8) {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const iso = toISODateLocal(d);
    buckets.push({
      iso,
      label: `${DAY_NAMES_ID[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`,
      total: 0,
    });
  }

  const byIso = new Map(buckets.map((b) => [b.iso, b]));
  for (const log of workLogs) {
    const key = toApiDate(log.work_date);
    const bucket = byIso.get(key);
    if (bucket) {
      bucket.total += Number(log.hours_spent || 0);
    }
  }

  return buckets.map((b) => {
    const normal = Math.min(b.total, dailyLimit);
    const overtime = Math.max(0, b.total - dailyLimit);
    return {
      label: b.label,
      normal_hours: Number(normal.toFixed(2)),
      overtime_hours: Number(overtime.toFixed(2)),
    };
  });
}

const QUICK_LINKS = [
  { to: '/employee/work-logs', icon: Clock, title: 'Riwayat Log Kerja' },
  { to: '/employee/surveys', icon: HeartHandshake, title: 'Survei Kondisi Kerja' },
  { to: '/employee/workplace-issues', icon: MessageSquareWarning, title: 'Lapor Masalah & K3' },
  { to: '/employee/workload-risk', icon: Activity, title: 'Detail Risiko Saya' },
  { to: '/employee/training-participations', icon: Award, title: 'Pelatihan Saya' },
];

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const employee = user?.employee;
  const fullName = employee?.full_name || user?.email || 'Pegawai';
  const normalWeeklyHours = Number(employee?.employment_type?.normal_weekly_hours || 40);
  const workDaysPerWeek = Number(employee?.employment_type?.work_days_per_week || 5);
  const dailyLimit = workDaysPerWeek >= 6 ? 7 : 8;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [workLogs, setWorkLogs] = useState([]);
  const [logSummary, setLogSummary] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [riskRow, setRiskRow] = useState(null);
  const [trainingsCount, setTrainingsCount] = useState(0);
  const [pendingSurveysCount, setPendingSurveysCount] = useState(0);

  // Quick Work Log Slide-over Sheet
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logFormError, setLogFormError] = useState('');
  const [logForm, setLogForm] = useState({
    task_assignment_id: '',
    work_date: toISODateLocal(),
    hours_spent: '2',
    activity_description: '',
  });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [logsRes, assignRes, riskRes, trainingRes, surveyRes] = await Promise.allSettled([
        workLogService.getWorkLogs(),
        taskAssignmentService.getTaskAssignments(),
        workloadRiskService.getWorkloadRisks(),
        trainingParticipationService.getTrainingParticipations(),
        surveyService.getSurveys(),
      ]);

      const allFailed = [logsRes, assignRes, riskRes].every((r) => r.status === 'rejected');
      if (allFailed) {
        setErrorMsg(
          extractApiError(logsRes.reason, 'Gagal memuat ringkasan ruang kerja pegawai.').message
        );
        return;
      }

      if (logsRes.status === 'fulfilled' && logsRes.value) {
        setWorkLogs(logsRes.value.work_logs || []);
        setLogSummary(logsRes.value.summary || {});
      }

      if (assignRes.status === 'fulfilled' && assignRes.value) {
        setAssignments(assignRes.value.assignments || []);
      }

      if (riskRes.status === 'fulfilled' && riskRes.value) {
        const list = riskRes.value.workload_risks || [];
        setRiskRow(list[0] || null);
      }

      if (trainingRes.status === 'fulfilled' && trainingRes.value) {
        const participations =
          trainingRes.value.participations ||
          trainingRes.value.training_participations ||
          [];
        setTrainingsCount(participations.length);
      }

      if (surveyRes.status === 'fulfilled' && surveyRes.value) {
        const surveys = surveyRes.value.surveys || [];
        const summaryPending = surveyRes.value.summary?.my_pending_count;
        const pending =
          typeof summaryPending === 'number'
            ? summaryPending
            : surveys.filter((s) => s.is_active && !s.my_response).length;
        setPendingSurveysCount(pending);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useRefetchOnFocus(loadWorkspace);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status !== 'completed' && a.status !== 'cancelled'),
    [assignments]
  );

  const urgentAssignmentsCount = useMemo(
    () => activeAssignments.filter((a) => Boolean(getDeadlineBadge(a.deadline, a.status))).length,
    [activeAssignments]
  );

  const dailyChartData = useMemo(
    () => buildRecentDailyChartData(workLogs, dailyLimit),
    [workLogs, dailyLimit]
  );

  const currentWeekHours = Number(
    riskRow?.metrics?.weekly_hours_total ?? logSummary.current_week_hours ?? 0
  );
  const weeklyHoursPct = Math.min(100, Math.round((currentWeekHours / normalWeeklyHours) * 100));

  const openQuickLogSheet = useCallback((assignment = null) => {
    setLogFormError('');
    setLogForm({
      task_assignment_id: assignment?.id ? String(assignment.id) : '',
      work_date: toISODateLocal(),
      hours_spent: '2',
      activity_description: assignment?.task?.title
        ? `Pengerjaan: ${assignment.task.title}`
        : '',
    });
    setLogSheetOpen(true);
  }, []);

  const handleQuickLogSubmit = async (event) => {
    event.preventDefault();
    setLogFormError('');

    if (!logForm.work_date) {
      setLogFormError('Tanggal kerja wajib diisi.');
      return;
    }

    setLogSubmitting(true);

    try {
      await workLogService.createWorkLog({
        employee_id: employee?.id,
        task_assignment_id: logForm.task_assignment_id ? Number(logForm.task_assignment_id) : null,
        work_date: toApiDate(logForm.work_date),
        hours_spent: Number(logForm.hours_spent),
        activity_description: logForm.activity_description.trim(),
      });
      toast.success('Log kerja tersimpan.');
      setLogSheetOpen(false);
      await loadWorkspace();
    } catch (err) {
      setLogFormError(
        extractApiError(err, 'Gagal menyimpan log kerja. Periksa isian Anda.').message
      );
    } finally {
      setLogSubmitting(false);
    }
  };

  // Calm Rows: 3 single-line columns; clicking any row opens Catat Log prefilled with that task
  const assignmentColumns = useMemo(
    () => [
      {
        accessorFn: (row) => row.task?.title || `Penugasan #${row.id}`,
        id: 'title',
        header: 'Tugas',
        cell: ({ row }) => {
          const title = row.original.task?.title || `Penugasan #${row.original.id}`;
          return (
            <span className="block max-w-[300px] truncate font-medium text-foreground" title={title}>
              {title}
            </span>
          );
        },
      },
      {
        accessorKey: 'deadline',
        header: 'Tenggat',
        cell: ({ row }) => (
          <span className="text-xs text-foreground whitespace-nowrap tabular-nums">
            {formatDate(row.original.deadline)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const item = row.original;
          const urgency = getDeadlineBadge(item.deadline, item.status);
          if (urgency) {
            return <StatusBadge tone={urgency.tone} label={urgency.label} />;
          }
          return (
            <StatusBadge
              status={item.status === 'assigned' ? 'open' : item.status}
              label={
                item.status === 'assigned'
                  ? 'Ditugaskan'
                  : item.status === 'in_progress'
                    ? 'Dikerjakan'
                    : undefined
              }
            />
          );
        },
      },
    ],
    []
  );

  const subIndicators = riskRow
    ? [
        { label: 'Waktu Kerja', score: riskRow.weekly_hours_score },
        { label: 'Lembur', score: riskRow.overtime_score },
        { label: 'Beban Tugas', score: riskRow.task_load_score },
        { label: 'Tekanan Tenggat', score: riskRow.deadline_pressure_score },
      ]
    : [];

  return (
    <AppShell title="Beranda" breadcrumb="Ruang Kerja">
      <div className="flex flex-col gap-8">
        {/* Compact Identity Header Strip */}
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-10 border border-border">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(employee?.full_name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold tracking-[-0.015em] text-foreground">
                  {fullName}
                </h2>
                <StatusBadge status="active" />
              </div>
              <p className="text-xs text-muted-foreground">
                {employee?.position?.title || 'Pegawai'} · {employee?.department?.name || '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-foreground">
                {employee?.employee_code || '-'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Briefcase aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>{employee?.employment_type?.name || 'Tetap'}</span>
            </div>
            <div className="flex items-center gap-1.5 tabular-nums">
              <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>
                {workDaysPerWeek} hari · {normalWeeklyHours}j/minggu
              </span>
            </div>
          </div>
        </section>

        {/* Error State */}
        {errorMsg && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-destructive/30 bg-card p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">Gagal memuat beranda</p>
                <p className="text-xs text-muted-foreground">{errorMsg}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadWorkspace}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Row 1: 4 Personal KPI Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Jam Minggu Ini"
              value={formatScore(currentWeekHours, 1)}
              unit={`/ ${normalWeeklyHours}j`}
              icon={Clock}
              progress={weeklyHoursPct}
              status={
                currentWeekHours >= 55
                  ? 'high'
                  : currentWeekHours > normalWeeklyHours
                    ? 'medium'
                    : 'low'
              }
              statusLabel={
                currentWeekHours >= 55
                  ? 'Melebihi PP 35'
                  : currentWeekHours > normalWeeklyHours
                    ? 'Ada lembur'
                    : 'Batas sehat'
              }
            />

            <KpiStatCard
              label="Workload Risk Saya"
              value={riskRow ? formatScore(riskRow.final_score, 1) : '-'}
              unit={riskRow ? '/ 100' : undefined}
              icon={Activity}
              status={riskRow?.risk_category || 'neutral'}
              statusLabel={riskRow ? undefined : 'Belum dihitung'}
            />

            <KpiStatCard
              label="Penugasan Aktif"
              value={activeAssignments.length}
              unit="tugas"
              icon={ClipboardCheck}
              hint={
                urgentAssignmentsCount > 0
                  ? `${urgentAssignmentsCount} tenggat dekat`
                  : 'Tenggat terkendali'
              }
            />

            <KpiStatCard
              label="Pelatihan"
              value={trainingsCount}
              unit="diikuti"
              icon={Award}
              hint={
                pendingSurveysCount > 0
                  ? `${pendingSurveysCount} survei belum diisi`
                  : 'Semua survei terisi'
              }
            />
          </section>
        )}

        {/* Row 2: Daily Hours Chart + Active Tasks (8 cols) | Risk Profile + Quick Links (4 cols) */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                    Jam Kerja 7 Hari Terakhir
                  </h3>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Garis batas {dailyLimit} jam/hari (PP 35/2021)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-[var(--chart-1)]" />
                      Normal
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-[var(--chart-3)]" />
                      Lembur
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    onClick={() => openQuickLogSheet(null)}
                  >
                    <Plus data-icon="inline-start" />
                    Catat Log
                  </Button>
                </div>
              </div>

              {loading ? (
                <Skeleton className="h-60 w-full rounded-xl" />
              ) : (
                <WorkHoursBarChart
                  data={dailyChartData}
                  dailyLimit={dailyLimit}
                  heightClass="h-60"
                />
              )}
            </div>

            <DataTable
              title="Penugasan Aktif"
              countLabel="tugas"
              columns={assignmentColumns}
              data={activeAssignments}
              loading={loading}
              searchable={true}
              searchPlaceholder="Cari tugas..."
              pageSize={6}
              onRowClick={(row) => openQuickLogSheet(row)}
              emptyTitle="Tidak ada penugasan aktif"
              emptyDescription="Semua penugasan selesai atau belum ada tugas baru."
              actionsSlot={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/employee/task-assignments">
                    Semua
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            />
          </div>

          {/* Right Rail: Personal 4 Sub-Indicators + Quick Links */}
          <div className="flex flex-col gap-6 xl:col-span-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  Profil Beban Kerja
                </h3>
                {riskRow?.period_week && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatWeek(riskRow.period_week)}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : subIndicators.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Skor minggu ini belum dihitung. Catat log kerja harian Anda.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {subIndicators.map((sub) => (
                    <div key={sub.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{sub.label}</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatScore(sub.score, 1)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.max(0, Number(sub.score || 0)))}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                  {riskRow?.recommendation_note && (
                    <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                      {riskRow.recommendation_note}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  Aksi Cepat
                </h3>
              </div>
              <div className="divide-y divide-border">
                {QUICK_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Quick Work Log Slide-Over Sheet */}
      <FormSheet
        open={logSheetOpen}
        onOpenChange={setLogSheetOpen}
        title="Catat Log Kerja"
        description="Simpan durasi kerja harian untuk memperbarui beban kerja Anda."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogSheetOpen(false)}
              disabled={logSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" form="quick-work-log-form" disabled={logSubmitting}>
              {logSubmitting && <Spinner data-icon="inline-start" />}
              Simpan
            </Button>
          </>
        }
      >
        <form
          id="quick-work-log-form"
          onSubmit={handleQuickLogSubmit}
          className="flex flex-col gap-4"
        >
          {logFormError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
            >
              {logFormError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-log-assignment" className="text-xs">
              Penugasan (Opsional)
            </Label>
            <Select
              value={logForm.task_assignment_id || NO_ASSIGNMENT_VALUE}
              onValueChange={(val) =>
                setLogForm((prev) => ({
                  ...prev,
                  task_assignment_id: val === NO_ASSIGNMENT_VALUE ? '' : val,
                }))
              }
            >
              <SelectTrigger id="quick-log-assignment" className="w-full rounded-lg bg-background">
                <SelectValue placeholder="Aktivitas umum" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_ASSIGNMENT_VALUE}>Aktivitas umum</SelectItem>
                  {activeAssignments.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.task?.title || `Penugasan #${a.id}`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-log-date" className="text-xs">
                Tanggal
              </Label>
              <DatePicker
                id="quick-log-date"
                value={logForm.work_date}
                onChange={(val) =>
                  setLogForm((prev) => ({ ...prev, work_date: val }))
                }
                ariaLabel="Tanggal kerja"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-log-hours" className="text-xs">
                Durasi (Jam)
              </Label>
              <Input
                id="quick-log-hours"
                name="hours_spent"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                value={logForm.hours_spent}
                onChange={(e) =>
                  setLogForm((prev) => ({ ...prev, hours_spent: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-log-desc" className="text-xs">
              Deskripsi Aktivitas
            </Label>
            <Textarea
              id="quick-log-desc"
              name="activity_description"
              rows={4}
              required
              placeholder="Ringkas pekerjaan yang diselesaikan hari ini..."
              value={logForm.activity_description}
              onChange={(e) =>
                setLogForm((prev) => ({ ...prev, activity_description: e.target.value }))
              }
            />
          </div>
        </form>
      </FormSheet>
    </AppShell>
  );
}
