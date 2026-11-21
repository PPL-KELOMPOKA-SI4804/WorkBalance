import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  Edit3,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatMonth, toApiMonth } from '@/lib/format';
import { extractApiError } from '@/services/api';
import { surveyService } from '@/services/surveyService';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AnimatedNumber,
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  MonthPicker,
  RowActionsMenu,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const WLB_LIKERT_LABELS = {
  1: 'Sangat Buruk',
  2: 'Kurang Baik',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Seimbang',
};

const WORKLOAD_LIKERT_LABELS = {
  1: 'Sangat Ringan',
  2: 'Terkendali',
  3: 'Sedang',
  4: 'Cukup Berat',
  5: 'Sangat Berat',
};

function getDimensionBadgeMeta(score) {
  if (score === null || score === undefined) {
    return { status: 'inactive', tone: 'neutral', label: 'Belum ada data' };
  }
  const num = Number(score);
  if (num >= 75) {
    return { status: 'good', tone: 'success', label: `${num.toFixed(1)} · Baik` };
  }
  if (num >= 50) {
    return {
      status: 'needs_attention',
      tone: 'warning',
      label: `${num.toFixed(1)} · Perlu Perhatian`,
    };
  }
  return {
    status: 'action_priority',
    tone: 'danger',
    label: `${num.toFixed(1)} · Prioritas`,
  };
}

function emptySurveyForm() {
  return {
    title: '',
    period_month: toApiMonth(new Date()),
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

function getSurveyActiveCount(survey) {
  if (survey?.active_employees_count !== null && survey?.active_employees_count !== undefined) {
    return Number(survey.active_employees_count);
  }
  if (
    survey?.total_active_employees !== null &&
    survey?.total_active_employees !== undefined
  ) {
    return Number(survey.total_active_employees);
  }
  if (Array.isArray(survey?.department_aggregates) && survey.department_aggregates.length > 0) {
    return survey.department_aggregates.reduce(
      (sum, dept) => sum + Number(dept.active_employees_count || 0),
      0
    );
  }
  return null;
}

function Nfr02PrivacyCue({ isEmployee, compact = false }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Info className="size-3.5 shrink-0 text-primary" />
          {compact ? (
            <>
              <span>NFR-02</span>
              <span className="hidden lg:inline">· Agregat per departemen</span>
            </>
          ) : (
            <span>Privasi NFR-02: Agregat per departemen</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
        {isEmployee
          ? 'Jawaban dan komentar Anda bersifat rahasia. Manajemen hanya melihat statistik agregat (AVG & COUNT) per departemen.'
          : 'Hanya menampilkan statistik agregat (AVG & COUNT) per departemen tanpa identitas, skor per individu, maupun komentar responden.'}
      </TooltipContent>
    </Tooltip>
  );
}

export default function SurveysPage() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isEmployee = user?.role === 'employee';
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [surveys, setSurveys] = useState([]);
  const [summary, setSummary] = useState({});

  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Aggregate Detail Sheet (Manager / Admin: strictly department aggregates only)
  const [aggregateSheetOpen, setAggregateSheetOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  // Create / Edit Survey Questionnaire Sheet (Manager / Admin)
  const [surveySheetOpen, setSurveySheetOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [surveyForm, setSurveyForm] = useState(emptySurveyForm);
  const [surveyFormError, setSurveyFormError] = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);

  // Delete Survey Dialog
  const [deletingSurvey, setDeletingSurvey] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Employee Survey Response Sheet
  const [responseSheetOpen, setResponseSheetOpen] = useState(false);
  const [respondingSurvey, setRespondingSurvey] = useState(null);
  const [responseForm, setResponseForm] = useState(emptyResponseForm);
  const [responseFormError, setResponseFormError] = useState('');
  const [responseSubmitting, setResponseSubmitting] = useState(false);

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
      setErrorMsg(
        extractApiError(err, 'Gagal memuat data survei kondisi kerja.').message
      );
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useRefetchOnFocus(loadAllData);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || activeFilter),
    [search, activeFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setActiveFilter('');
  };

  // Questionnaire CRUD (Admin & Manager)
  const openCreateSurveySheet = useCallback(() => {
    setEditingSurvey(null);
    setSurveyForm(emptySurveyForm());
    setSurveyFormError('');
    setSurveySheetOpen(true);
  }, []);

  const openEditSurveySheet = useCallback((survey) => {
    setEditingSurvey(survey);
    setSurveyForm({
      title: survey.title || '',
      period_month: toApiMonth(survey.period_month) || '',
      description: survey.description || '',
      is_active: Boolean(survey.is_active),
    });
    setSurveyFormError('');
    setSurveySheetOpen(true);
  }, []);

  const openAggregateSheet = useCallback((survey) => {
    setSelectedSurvey(survey);
    setAggregateSheetOpen(true);
  }, []);

  const handleSurveySubmit = async (e) => {
    e.preventDefault();
    setSurveyFormError('');

    const trimmedTitle = surveyForm.title.trim();
    const normalizedPeriod = toApiMonth(surveyForm.period_month);

    if (!trimmedTitle) {
      setSurveyFormError('Judul survei wajib diisi.');
      return;
    }
    if (!normalizedPeriod) {
      setSurveyFormError('Periode bulan wajib dipilih.');
      return;
    }

    setSurveySubmitting(true);

    const payload = {
      title: trimmedTitle,
      period_month: normalizedPeriod,
      description: surveyForm.description.trim() || null,
      is_active: Boolean(surveyForm.is_active),
    };

    try {
      if (editingSurvey) {
        const res = await surveyService.updateSurvey(editingSurvey.id, payload);
        toast.success(res.message || 'Survei kondisi kerja berhasil diperbarui.');
      } else {
        const res = await surveyService.createSurvey(payload);
        toast.success(res.message || 'Periode survei kondisi kerja berhasil dibuat.');
      }
      setSurveySheetOpen(false);
      await loadAllData();
    } catch (err) {
      setSurveyFormError(
        extractApiError(err, 'Gagal menyimpan survei kondisi kerja.').message
      );
    } finally {
      setSurveySubmitting(false);
    }
  };

  const handleConfirmDeleteSurvey = async () => {
    if (!deletingSurvey) return;
    setDeleteLoading(true);

    try {
      const res = await surveyService.deleteSurvey(deletingSurvey.id);
      toast.success(res.message || 'Survei kondisi kerja berhasil dihapus.');
      setDeletingSurvey(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Survei tidak dapat dihapus.').message);
      setDeletingSurvey(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Employee Response Handlers
  const openResponseSheet = useCallback((survey) => {
    setRespondingSurvey(survey);
    if (survey.my_response) {
      setResponseForm({
        work_life_balance_score: Number(survey.my_response.work_life_balance_score || 4),
        workload_perception_score: Number(
          survey.my_response.workload_perception_score || 3
        ),
        comments: survey.my_response.comments || '',
      });
    } else {
      setResponseForm(emptyResponseForm());
    }
    setResponseFormError('');
    setResponseSheetOpen(true);
  }, []);

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
        toast.success(res.message || 'Respons survei Anda berhasil diperbarui.');
      } else {
        const res = await surveyService.submitResponse(respondingSurvey.id, payload);
        toast.success(res.message || 'Respons survei Anda berhasil dikirim.');
      }
      setResponseSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setResponseFormError(
        extractApiError(err, 'Gagal mengirim respons survei.').message
      );
    } finally {
      setResponseSubmitting(false);
    }
  };

  // Department Aggregate Columns (NFR-02: Department-level aggregated metrics ONLY)
  const departmentAggregateColumns = useMemo(
    () => [
      {
        accessorKey: 'department_name',
        header: 'Departemen',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {row.original.department_code}
            </Badge>
            <span
              className="max-w-[180px] truncate text-xs font-medium text-foreground"
              title={row.original.department_name}
            >
              {row.original.department_name}
            </span>
          </div>
        ),
      },
      {
        accessorFn: (row) => Number(row.participation_rate || 0),
        id: 'participation',
        header: 'Partisipasi',
        cell: ({ row }) => {
          const rate = Number(row.original.participation_rate || 0);
          return (
            <span className="text-xs text-foreground whitespace-nowrap tabular-nums">
              <span className="font-medium">
                {row.original.respondents_count} / {row.original.active_employees_count}
              </span>{' '}
              <span className="text-muted-foreground">({rate.toFixed(1)}%)</span>
            </span>
          );
        },
      },
      {
        accessorFn: (row) =>
          row.avg_wlb_score !== null && row.avg_wlb_score !== undefined
            ? Number(row.avg_wlb_score)
            : -1,
        id: 'avg_wlb',
        header: 'Skor WLB',
        cell: ({ row }) => {
          const meta = getDimensionBadgeMeta(row.original.converted_wlb_dimension_score);
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs font-medium text-foreground tabular-nums">
                {row.original.avg_wlb_score !== null && row.original.avg_wlb_score !== undefined
                  ? `${Number(row.original.avg_wlb_score).toFixed(2)} / 5`
                  : '-'}
              </span>
              <StatusBadge status={meta.status} tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      },
      {
        accessorFn: (row) =>
          row.avg_workload_perception_score !== null &&
          row.avg_workload_perception_score !== undefined
            ? Number(row.avg_workload_perception_score)
            : -1,
        id: 'workload_perception',
        header: 'Persepsi Beban',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {row.original.avg_workload_perception_score !== null &&
            row.original.avg_workload_perception_score !== undefined
              ? `${Number(row.original.avg_workload_perception_score).toFixed(2)} / 5`
              : '-'}
          </span>
        ),
      },
    ],
    []
  );

  // Main Survey Table Columns (max 4 data columns + RowActionsMenu, strictly 1 line per cell)
  const columns = useMemo(() => {
    const baseCols = [
      {
        accessorKey: 'title',
        header: 'Judul',
        cell: ({ row }) => (
          <span
            className="block max-w-[260px] truncate text-xs font-medium text-foreground"
            title={row.original.title}
          >
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: 'period_month',
        header: 'Periode',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {formatMonth(row.original.period_month)}
          </span>
        ),
      },
      {
        accessorFn: (row) => (row.is_active ? 1 : 0),
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <StatusBadge
              status={row.original.is_active ? 'active' : 'inactive'}
              label={row.original.is_active ? 'Dibuka' : 'Ditutup'}
            />
          </div>
        ),
      },
    ];

    if (isEmployee) {
      return [
        ...baseCols,
        {
          accessorFn: (row) => (row.my_response ? 1 : 0),
          id: 'my_participation',
          header: 'Partisipasi',
          cell: ({ row }) => {
            const hasResponded = Boolean(row.original.my_response);
            return (
              <div className="whitespace-nowrap">
                <StatusBadge
                  status={hasResponded ? 'completed' : 'pending'}
                  label={hasResponded ? 'Sudah Diisi' : 'Belum Diisi'}
                />
              </div>
            );
          },
        },
        {
          id: 'actions',
          header: () => <span className="sr-only">Aksi</span>,
          enableSorting: false,
          cell: ({ row }) => {
            const survey = row.original;
            if (!survey.is_active) {
              return null;
            }
            return (
              <RowActionsMenu
                ariaLabel="Aksi survei"
                items={[
                  {
                    key: 'respond',
                    label: survey.my_response ? 'Perbarui Jawaban' : 'Isi Survei',
                    icon: Edit3,
                    onSelect: () => openResponseSheet(survey),
                  },
                ]}
              />
            );
          },
        },
      ];
    }

    // Manager & Admin view: STRICTLY AGGREGATED METRICS (NFR-02)
    return [
      ...baseCols,
      {
        accessorFn: (row) => Number(row.responses_count || 0),
        id: 'participation',
        header: 'Partisipasi',
        cell: ({ row }) => {
          const survey = row.original;
          const respondents = Number(survey.responses_count ?? 0);
          const activeCount = getSurveyActiveCount(survey);
          const rate = Number(survey.participation_rate || 0);

          return (
            <span className="text-xs text-foreground whitespace-nowrap tabular-nums">
              <span className="font-medium">
                {activeCount !== null && activeCount > 0
                  ? `${respondents} / ${activeCount}`
                  : respondents}
              </span>{' '}
              <span className="text-muted-foreground">({rate.toFixed(1)}%)</span>
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const survey = row.original;
          const hasResponses = Number(survey.responses_count || 0) > 0;
          return (
            <RowActionsMenu
              ariaLabel="Aksi periode survei"
              items={[
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditSurveySheet(survey),
                },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  title: hasResponses
                    ? 'Sudah memiliki respons (penghapusan dilindungi sistem)'
                    : 'Hapus survei',
                  onSelect: () => setDeletingSurvey(survey),
                },
              ]}
            />
          );
        },
      },
    ];
  }, [isEmployee, openEditSurveySheet, openResponseSheet]);

  const overallWlbMeta = getDimensionBadgeMeta(summary.overall_wlb_dimension_score);
  const overallParticipation = Number(summary.overall_participation_rate || 0);

  return (
    <AppShell
      title="Survei Kondisi Kerja"
      breadcrumb={isEmployee ? 'Ruang Kerja' : 'Kesejahteraan'}
      actions={<Nfr02PrivacyCue isEmployee={isEmployee} compact />}
    >
      <div className="flex flex-col gap-8">
        {/* Row 1: 4 KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : isEmployee ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Survei Dibuka"
              value={summary.active_surveys_count ?? 0}
              unit="periode"
              hint={`Dari ${summary.total_surveys ?? 0} periode`}
            />

            <KpiStatCard
              label="Sudah Diisi"
              value={summary.my_submitted_count ?? 0}
              unit="survei"
              status="completed"
              statusLabel="Partisipasi tercatat"
            />

            <KpiStatCard
              label="Menunggu Pengisian"
              value={summary.my_pending_count ?? 0}
              unit="survei"
              statusTone={Number(summary.my_pending_count || 0) > 0 ? 'warning' : 'success'}
              statusLabel={
                Number(summary.my_pending_count || 0) > 0
                  ? 'Perlu dilengkapi'
                  : 'Semua terisi'
              }
            />

            <KpiStatCard
              label="Rata-rata WLB Saya"
              value={
                summary.my_avg_wlb !== null && summary.my_avg_wlb !== undefined
                  ? Number(summary.my_avg_wlb).toFixed(1)
                  : '-'
              }
              unit={
                summary.my_avg_wlb !== null && summary.my_avg_wlb !== undefined
                  ? '/ 5'
                  : undefined
              }
              hint="Skala Likert 1–5 pribadi"
            />
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Total Periode"
              value={summary.total_surveys ?? 0}
              unit="periode"
              hint={`${summary.active_surveys_count ?? 0} periode dibuka`}
            />

            <KpiStatCard
              label="Rata-rata WLB"
              value={
                summary.overall_avg_wlb !== null && summary.overall_avg_wlb !== undefined
                  ? Number(summary.overall_avg_wlb).toFixed(2)
                  : '-'
              }
              unit={
                summary.overall_avg_wlb !== null && summary.overall_avg_wlb !== undefined
                  ? '/ 5'
                  : undefined
              }
              status={overallWlbMeta.status}
              statusTone={overallWlbMeta.tone}
              statusLabel={`Dimensi WLB ${summary.overall_wlb_dimension_score ?? 0}/100`}
            />

            <KpiStatCard
              label="Persepsi Beban"
              value={
                summary.overall_avg_workload_perception !== null &&
                summary.overall_avg_workload_perception !== undefined
                  ? Number(summary.overall_avg_workload_perception).toFixed(2)
                  : '-'
              }
              unit={
                summary.overall_avg_workload_perception !== null &&
                summary.overall_avg_workload_perception !== undefined
                  ? '/ 5'
                  : undefined
              }
              hint="Agregat seluruh tim"
            />

            <KpiStatCard
              label="Tingkat Partisipasi"
              value={`${overallParticipation.toFixed(1)}%`}
              statusTone={overallParticipation >= 75 ? 'success' : 'warning'}
              statusLabel={`${summary.total_responses ?? 0} respons agregat`}
            />
          </section>
        )}

        {/* Row 2: Surveys DataTable */}
        <DataTable
          title="Periode Survei"
          countLabel="periode"
          columns={columns}
          data={surveys}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari judul atau periode survei..."
          pageSize={10}
          onRowClick={(row) => {
            if (isEmployee) {
              if (row.is_active) openResponseSheet(row);
            } else {
              openAggregateSheet(row);
            }
          }}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada survei sesuai filter'
              : 'Belum ada periode survei'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau setel ulang filter.'
              : canManage
                ? 'Buat periode survei baru untuk mulai mengumpulkan umpan balik keseimbangan kerja pegawai.'
                : 'Belum ada kuesioner survei yang dibuka untuk periode ini.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={resetFilters}>
                  <RotateCcw className="size-4" data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              {canManage && (
                <Button size="sm" className="rounded-lg" onClick={openCreateSurveySheet}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Buat Survei
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="filter_is_active"
                value={activeFilter || ALL_VALUE}
                onValueChange={(val) => setActiveFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="survey-filter-status"
                  size="sm"
                  aria-label="Filter Status Periode"
                  className="w-40 rounded-lg bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="1">Dibuka</SelectItem>
                    <SelectItem value="0">Ditutup</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="survey-reset-filters"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={resetFilters}
                    >
                      <RotateCcw className="size-4" data-icon="inline-start" />
                      Reset
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          }
          actionsSlot={
            canManage ? (
              <Button size="sm" className="rounded-lg" onClick={openCreateSurveySheet}>
                <Plus className="size-4" data-icon="inline-start" />
                Buat Survei
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Sheet 1: Hasil Agregat Departemen (Manager & Admin: strict NFR-02 aggregation only) */}
      {!isEmployee && (
        <FormSheet
          open={aggregateSheetOpen && Boolean(selectedSurvey)}
          onOpenChange={setAggregateSheetOpen}
          title={
            selectedSurvey
              ? `Agregat Departemen · ${formatMonth(selectedSurvey.period_month)}`
              : 'Agregat Departemen'
          }
          description={selectedSurvey?.title || undefined}
          size="xl"
          loading={!selectedSurvey}
          footer={
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setAggregateSheetOpen(false)}
            >
              Tutup
            </Button>
          }
        >
          {selectedSurvey && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Nfr02PrivacyCue isEmployee={false} />
                </div>
                {selectedSurvey.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedSurvey.description}
                  </p>
                )}
              </div>

              {/* Overall Period Aggregate Summary: open divided strip, no nested boxes */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
                <div className="flex flex-col gap-2 sm:pr-5">
                  <span className="text-xs text-muted-foreground">Partisipasi Periode</span>
                  <div className="flex items-baseline justify-between gap-2">
                    <AnimatedNumber
                      value={`${Number(selectedSurvey.participation_rate || 0).toFixed(1)}%`}
                      className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {selectedSurvey.responses_count ?? 0} respons
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, Number(selectedSurvey.participation_rate || 0)))}
                    className="h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:px-5">
                  <span className="text-xs text-muted-foreground">Rata-rata WLB</span>
                  <div className="flex items-baseline gap-1">
                    <AnimatedNumber
                      value={
                        selectedSurvey.avg_wlb_score !== null &&
                        selectedSurvey.avg_wlb_score !== undefined
                          ? Number(selectedSurvey.avg_wlb_score).toFixed(2)
                          : '-'
                      }
                      className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">/ 5</span>
                  </div>
                  <div className="flex">
                    <StatusBadge
                      status={
                        getDimensionBadgeMeta(selectedSurvey.converted_wlb_dimension_score).status
                      }
                      tone={
                        getDimensionBadgeMeta(selectedSurvey.converted_wlb_dimension_score).tone
                      }
                      label={
                        getDimensionBadgeMeta(selectedSurvey.converted_wlb_dimension_score).label
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:pl-5">
                  <span className="text-xs text-muted-foreground">Persepsi Beban Kerja</span>
                  <div className="flex items-baseline gap-1">
                    <AnimatedNumber
                      value={
                        selectedSurvey.avg_workload_perception_score !== null &&
                        selectedSurvey.avg_workload_perception_score !== undefined
                          ? Number(selectedSurvey.avg_workload_perception_score).toFixed(2)
                          : '-'
                      }
                      className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">/ 5</span>
                  </div>
                  {selectedSurvey.avg_workload_perception_score !== null &&
                    selectedSurvey.avg_workload_perception_score !== undefined && (
                      <Progress
                        value={Math.min(
                          100,
                          Math.max(
                            0,
                            (Number(selectedSurvey.avg_workload_perception_score) / 5) * 100
                          )
                        )}
                        className="h-1.5"
                      />
                    )}
                </div>
              </div>

              <Separator />

              {/* Department Aggregates DataTable (strictly department-level aggregates) */}
              <DataTable
                title="Agregat per Departemen"
                countLabel="departemen"
                columns={departmentAggregateColumns}
                data={selectedSurvey.department_aggregates || []}
                searchable={false}
                pageSize={20}
                emptyTitle="Belum ada data agregat departemen"
                emptyDescription="Statistik agregat akan muncul setelah pegawai mengirimkan respons pada periode survei ini."
              />
            </div>
          )}
        </FormSheet>
      )}

      {/* Sheet 2: Buat / Ubah Periode Survei (Manager & Admin) */}
      {canManage && (
        <FormSheet
          open={surveySheetOpen}
          onOpenChange={setSurveySheetOpen}
          title={editingSurvey ? 'Ubah Periode Survei' : 'Buat Periode Survei'}
          description="Atur judul, periode bulan, status pembukaan, dan deskripsi survei."
          size="md"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setSurveySheetOpen(false)}
                disabled={surveySubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="survey-form"
                className="rounded-lg"
                disabled={surveySubmitting}
              >
                {surveySubmitting && <Spinner data-icon="inline-start" />}
                {surveySubmitting
                  ? 'Menyimpan...'
                  : editingSurvey
                    ? 'Simpan Perubahan'
                    : 'Buat Survei'}
              </Button>
            </>
          }
        >
          <form
            id="survey-form"
            onSubmit={handleSurveySubmit}
            className="flex flex-col gap-5"
          >
            <AnimatePresence initial={false}>
              {surveyFormError && (
                <motion.div
                  key="survey-form-error"
                  role="alert"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{surveyFormError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="survey-title">Judul Survei</Label>
              <Input
                id="survey-title"
                name="title"
                type="text"
                required
                maxLength={200}
                value={surveyForm.title}
                onChange={(e) =>
                  setSurveyForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Contoh: Survei Kondisi Kerja Desember 2026"
                className="rounded-lg bg-background"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="survey-period-month">Periode Bulan</Label>
                <MonthPicker
                  id="survey-period-month"
                  ariaLabel="Periode Bulan"
                  value={surveyForm.period_month}
                  onChange={(val) =>
                    setSurveyForm((prev) => ({ ...prev, period_month: val }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="survey-is-active">Status Pengisian</Label>
                <Select
                  name="is_active"
                  value={surveyForm.is_active ? '1' : '0'}
                  onValueChange={(val) =>
                    setSurveyForm((prev) => ({ ...prev, is_active: val === '1' }))
                  }
                >
                  <SelectTrigger id="survey-is-active" className="w-full rounded-lg bg-background">
                    <SelectValue placeholder="Pilih Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">Dibuka (Aktif)</SelectItem>
                      <SelectItem value="0">Ditutup</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="survey-description">
                Deskripsi / Tujuan Survei (Opsional)
              </Label>
              <Textarea
                id="survey-description"
                name="description"
                rows={4}
                maxLength={2000}
                value={surveyForm.description}
                onChange={(e) =>
                  setSurveyForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Penjelasan singkat mengenai tujuan pengisian survei periode ini..."
                className="rounded-lg bg-background"
              />
            </div>
          </form>
        </FormSheet>
      )}

      {/* Dialog Konfirmasi Hapus Survei */}
      {canManage && (
        <ConfirmDialog
          open={Boolean(deletingSurvey)}
          onOpenChange={(open) => {
            if (!open) setDeletingSurvey(null);
          }}
          title="Hapus Periode Survei?"
          description={
            deletingSurvey ? (
              <>
                Survei{' '}
                <span className="font-semibold text-foreground">
                  {deletingSurvey.title}
                </span>{' '}
                (<span className="tabular-nums">{formatMonth(deletingSurvey.period_month)}</span>)
                akan dihapus.
                {Number(deletingSurvey.responses_count || 0) > 0 && (
                  <span className="mt-2 block text-xs text-destructive">
                    Perhatian: Survei ini sudah memiliki {deletingSurvey.responses_count}{' '}
                    respons pegawai. Penghapusan akan ditolak oleh sistem.
                  </span>
                )}
              </>
            ) : undefined
          }
          confirmLabel={deleteLoading ? 'Memproses...' : 'Hapus'}
          loading={deleteLoading}
          onConfirm={handleConfirmDeleteSurvey}
        />
      )}

      {/* Sheet 3: Pengisian Survei Kondisi Kerja (Employee Likert 1–5) */}
      {isEmployee && (
        <FormSheet
          open={responseSheetOpen && Boolean(respondingSurvey)}
          onOpenChange={setResponseSheetOpen}
          title={
            respondingSurvey?.my_response
              ? 'Perbarui Jawaban Survei'
              : 'Isi Survei Kondisi Kerja'
          }
          description={
            respondingSurvey
              ? `${respondingSurvey.title} (${formatMonth(respondingSurvey.period_month)})`
              : undefined
          }
          size="md"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setResponseSheetOpen(false)}
                disabled={responseSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="survey-response-form"
                className="rounded-lg"
                disabled={responseSubmitting}
              >
                {responseSubmitting && <Spinner data-icon="inline-start" />}
                {responseSubmitting
                  ? 'Mengirim...'
                  : respondingSurvey?.my_response
                    ? 'Perbarui Jawaban'
                    : 'Kirim Jawaban'}
              </Button>
            </>
          }
        >
          {respondingSurvey && (
            <form
              id="survey-response-form"
              onSubmit={handleResponseSubmit}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Nfr02PrivacyCue isEmployee />
                </div>
                {respondingSurvey.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {respondingSurvey.description}
                  </p>
                )}
              </div>

              <AnimatePresence initial={false}>
                {responseFormError && (
                  <motion.div
                    key="response-form-error"
                    role="alert"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                    className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{responseFormError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Question 1: Work-Life Balance (Approved Likert 1–5 ToggleGroup) */}
              <div className="flex flex-col gap-3">
                <p id="survey-wlb-label" className="text-sm leading-snug font-medium text-foreground">
                  1. Keseimbangan Kehidupan &amp; Pekerjaan (Work-Life Balance)
                </p>
                <ToggleGroup
                  type="single"
                  aria-labelledby="survey-wlb-label"
                  value={String(responseForm.work_life_balance_score)}
                  onValueChange={(val) => {
                    if (val) {
                      setResponseForm((prev) => ({
                        ...prev,
                        work_life_balance_score: Number(val),
                      }));
                    }
                  }}
                  variant="outline"
                  spacing={2}
                  className="grid w-full grid-cols-5"
                >
                  {[1, 2, 3, 4, 5].map((score) => (
                    <ToggleGroupItem
                      key={score}
                      value={String(score)}
                      className="h-10 rounded-lg text-sm font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {score}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Progress
                  value={(Number(responseForm.work_life_balance_score) / 5) * 100}
                  className="h-1.5"
                />
                <p className="text-xs font-medium text-primary">
                  {WLB_LIKERT_LABELS[responseForm.work_life_balance_score]}
                </p>
              </div>

              <Separator />

              {/* Question 2: Workload Perception (Approved Likert 1–5 ToggleGroup) */}
              <div className="flex flex-col gap-3">
                <p
                  id="survey-workload-label"
                  className="text-sm leading-snug font-medium text-foreground"
                >
                  2. Persepsi Beban Kerja Saat Ini (Workload Perception)
                </p>
                <ToggleGroup
                  type="single"
                  aria-labelledby="survey-workload-label"
                  value={String(responseForm.workload_perception_score)}
                  onValueChange={(val) => {
                    if (val) {
                      setResponseForm((prev) => ({
                        ...prev,
                        workload_perception_score: Number(val),
                      }));
                    }
                  }}
                  variant="outline"
                  spacing={2}
                  className="grid w-full grid-cols-5"
                >
                  {[1, 2, 3, 4, 5].map((score) => (
                    <ToggleGroupItem
                      key={score}
                      value={String(score)}
                      className="h-10 rounded-lg text-sm font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {score}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Progress
                  value={(Number(responseForm.workload_perception_score) / 5) * 100}
                  className="h-1.5"
                />
                <p className="text-xs font-medium text-foreground">
                  {WORKLOAD_LIKERT_LABELS[responseForm.workload_perception_score]}
                </p>
              </div>

              <Separator />

              {/* Optional Comments */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="survey-response-comments">
                  Catatan atau Masukan Tambahan (Opsional &amp; Rahasia)
                </Label>
                <Textarea
                  id="survey-response-comments"
                  name="comments"
                  rows={4}
                  maxLength={1000}
                  value={responseForm.comments}
                  onChange={(e) =>
                    setResponseForm((prev) => ({ ...prev, comments: e.target.value }))
                  }
                  placeholder="Bagikan pengalaman kerja, masukan distribusi tugas, atau kendala waktu istirahat..."
                  className="rounded-lg bg-background"
                />
              </div>
            </form>
          )}
        </FormSheet>
      )}
    </AppShell>
  );
}
