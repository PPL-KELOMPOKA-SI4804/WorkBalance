import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  Edit3,
  Eye,
  GraduationCap,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { trainingService } from '@/services/trainingService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Teknis & Rekayasa',
  'Keselamatan & K3',
  'Kepemimpinan & Manajemen',
  'Kesejahteraan & Produktivitas',
];

const PARTICIPATION_STATUS_META = {
  enrolled: { status: 'enrolled', label: 'Terdaftar' },
  completed: { status: 'completed', label: 'Selesai' },
  dropped: { tone: 'danger', label: 'Berhenti' },
};

function getScheduleMeta(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) {
    return { label: 'Terjadwal', tone: 'neutral' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${String(startDateStr).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDateStr).slice(0, 10)}T00:00:00`);

  if (today < start) {
    return { label: 'Akan Datang', tone: 'info' };
  }

  if (today > end) {
    return { label: 'Selesai', tone: 'neutral' };
  }

  return { label: 'Sedang Berjalan', tone: 'success' };
}

function emptyTrainingForm() {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    title: '',
    category: 'Teknis & Rekayasa',
    provider: '',
    duration_hours: '8',
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export default function TrainingsPage() {
  const shouldReduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [trainings, setTrainings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    upcoming: 0,
    ongoing: 0,
    ended: 0,
    total_duration_hours: 0,
    total_participations: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Detail Slide-Over Sheet State
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Create / Edit Slide-Over Sheet State
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [form, setForm] = useState(emptyTrainingForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Dialog State
  const [deletingTraining, setDeletingTraining] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await trainingService.getTrainings({
        search: search.trim(),
        schedule_status: scheduleFilter,
        category: categoryFilter,
      });

      setTrainings(data?.trainings || []);
      setCategories(data?.categories || []);
      setSummary(
        data?.summary || {
          total: 0,
          upcoming: 0,
          ongoing: 0,
          ended: 0,
          total_duration_hours: 0,
          total_participations: 0,
        }
      );
      setHasLoaded(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat katalog pelatihan.').message);
    } finally {
      setLoading(false);
    }
  }, [search, scheduleFilter, categoryFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || scheduleFilter || categoryFilter),
    [search, scheduleFilter, categoryFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setScheduleFilter('');
    setCategoryFilter('');
  };

  const categorySuggestions = useMemo(() => {
    const merged = new Set([...DEFAULT_CATEGORY_SUGGESTIONS, ...categories]);
    return Array.from(merged);
  }, [categories]);

  // --- Detail Handler ---
  const openDetailSheet = useCallback(async (training) => {
    setSelectedTraining(training);
    setDetailSheetOpen(true);
    setDetailLoading(true);

    try {
      const detail = await trainingService.getTraining(training.id);
      setSelectedTraining(detail);
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal memuat detail program pelatihan.').message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // --- Create / Edit Handlers ---
  const openCreateSheet = useCallback(() => {
    setEditingTraining(null);
    setForm(emptyTrainingForm());
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((training) => {
    setEditingTraining(training);
    setForm({
      title: training.title || '',
      category: training.category || '',
      provider: training.provider || '',
      duration_hours: String(Number(training.duration_hours || 1)),
      start_date: training.start_date ? String(training.start_date).slice(0, 10) : '',
      end_date: training.end_date ? String(training.end_date).slice(0, 10) : '',
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (form.end_date < form.start_date) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      provider: form.provider.trim(),
      duration_hours: Number(form.duration_hours),
      start_date: form.start_date,
      end_date: form.end_date,
    };

    try {
      if (editingTraining) {
        const res = await trainingService.updateTraining(editingTraining.id, payload);
        toast.success(res.message || 'Program pelatihan berhasil diperbarui.');
      } else {
        const res = await trainingService.createTraining(payload);
        toast.success(res.message || 'Program pelatihan berhasil ditambahkan.');
      }
      setFormSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan program pelatihan.').message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingTraining) return;
    setDeleteLoading(true);

    try {
      const res = await trainingService.deleteTraining(deletingTraining.id);
      toast.success(res.message || 'Program pelatihan berhasil dihapus.');
      setDeletingTraining(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Program pelatihan tidak dapat dihapus.').message);
      setDeletingTraining(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const activeScheduleCount = Number(summary.ongoing || 0) + Number(summary.upcoming || 0);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Program Pelatihan',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex max-w-[260px] flex-col gap-1 whitespace-normal">
              <span className="line-clamp-2 font-medium text-foreground">{item.title}</span>
              <Badge variant="secondary" className="w-fit text-xs font-normal">
                {item.category}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: 'provider',
        header: 'Penyelenggara',
        cell: ({ row }) => (
          <span className="block max-w-[180px] line-clamp-2 text-xs font-medium text-foreground whitespace-normal">
            {row.original.provider}
          </span>
        ),
      },
      {
        accessorFn: (row) => Number(row.duration_hours || 0),
        id: 'duration_hours',
        header: 'Durasi',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {Number(row.original.duration_hours || 0).toFixed(1)} jam
          </span>
        ),
      },
      {
        accessorKey: 'start_date',
        header: 'Jadwal',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {item.start_date ? String(item.start_date).slice(0, 10) : '-'}
              </span>
              <span className="text-xs text-muted-foreground">
                s.d. {item.end_date ? String(item.end_date).slice(0, 10) : '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => getScheduleMeta(row.start_date, row.end_date).label,
        id: 'schedule_status',
        header: 'Status Jadwal',
        cell: ({ row }) => {
          const scheduleMeta = getScheduleMeta(row.original.start_date, row.original.end_date);
          return <StatusBadge tone={scheduleMeta.tone} label={scheduleMeta.label} />;
        },
      },
      {
        accessorFn: (row) => Number(row.participations_count || 0),
        id: 'participations_count',
        header: 'Peserta',
        cell: ({ row }) => {
          const count = Number(row.original.participations_count || 0);
          const inUse = count > 0;
          return (
            <Badge
              variant={inUse ? 'secondary' : 'outline'}
              className="gap-1 text-xs font-medium whitespace-nowrap tabular-nums"
              title={
                inUse
                  ? 'Tidak dapat dihapus karena masih memiliki data keikutsertaan pegawai'
                  : 'Belum memiliki peserta terdaftar'
              }
            >
              {inUse && <Lock className="size-3.5 text-muted-foreground" />}
              {count} peserta
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          const inUse = Number(item.participations_count || 0) > 0;
          return (
            <div className="-mr-1.5 flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetailSheet(item);
                }}
                aria-label={`Lihat detail ${item.title}`}
                title="Lihat Detail Pelatihan"
                className="rounded-lg text-muted-foreground hover:text-primary"
              >
                <Eye className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditSheet(item);
                }}
                aria-label={`Ubah ${item.title}`}
                title="Ubah Pelatihan"
                className="rounded-lg text-muted-foreground hover:text-primary"
              >
                <Edit3 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingTraining(item);
                }}
                aria-label={`Hapus ${item.title}`}
                title={
                  inUse
                    ? 'Masih memiliki peserta terdaftar (penghapusan ditolak sistem)'
                    : 'Hapus Pelatihan'
                }
                className={
                  inUse
                    ? 'rounded-lg text-muted-foreground hover:text-amber-700'
                    : 'rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [openDetailSheet, openEditSheet]
  );

  const selectedScheduleMeta = selectedTraining
    ? getScheduleMeta(selectedTraining.start_date, selectedTraining.end_date)
    : null;

  return (
    <AppShell
      title="Katalog Pelatihan"
      breadcrumb="Kesejahteraan"
      actions={
        <Button size="sm" onClick={openCreateSheet} className="rounded-lg">
          <Plus data-icon="inline-start" className="size-4" />
          Tambah Pelatihan
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        {/* Row 1: 4 KPI Summary Cards */}
        {loading && !hasLoaded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Total Program"
              value={summary.total}
              unit="program"
              icon={GraduationCap}
              hint={`${categories.length} kategori`}
            />

            <KpiStatCard
              label="Jadwal Aktif"
              value={activeScheduleCount}
              unit="program"
              icon={Calendar}
              status={Number(summary.ongoing || 0) > 0 ? 'active' : 'planned'}
              statusLabel={`${summary.ongoing} berjalan · ${summary.upcoming} mendatang`}
            />

            <KpiStatCard
              label="Durasi Kurikulum"
              value={Number(summary.total_duration_hours || 0).toFixed(1)}
              unit="jam"
              icon={Clock}
              hint="Total jam pelatihan"
            />

            <KpiStatCard
              label="Partisipasi Peserta"
              value={summary.total_participations}
              unit="peserta"
              icon={Users}
              hint="Total keikutsertaan"
            />
          </section>
        )}

        {/* Row 2: Training Catalog DataTable */}
        <DataTable
          title="Program Pelatihan"
          countLabel="program"
          columns={columns}
          data={trainings}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari judul, kategori, atau penyelenggara..."
          pageSize={10}
          onRowClick={openDetailSheet}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada program pelatihan yang sesuai filter'
              : 'Belum ada program pelatihan'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau setel ulang filter jadwal dan kategori.'
              : 'Tambahkan program pelatihan baru untuk mendokumentasikan pengembangan kompetensi tim.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="rounded-lg">
                  <RotateCcw data-icon="inline-start" className="size-4" />
                  Setel Ulang Filter
                </Button>
              )}
              <Button size="sm" onClick={openCreateSheet} className="rounded-lg">
                <Plus data-icon="inline-start" className="size-4" />
                Tambah Pelatihan
              </Button>
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="filter_schedule"
                value={scheduleFilter || ALL_VALUE}
                onValueChange={(val) => setScheduleFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="training-filter-schedule"
                  size="sm"
                  className="w-40 rounded-lg bg-background text-xs"
                  aria-label="Filter Status Jadwal"
                >
                  <SelectValue placeholder="Semua Jadwal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Jadwal</SelectItem>
                    <SelectItem value="ongoing">Sedang Berjalan</SelectItem>
                    <SelectItem value="upcoming">Akan Datang</SelectItem>
                    <SelectItem value="ended">Selesai</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="filter_category"
                value={categoryFilter || ALL_VALUE}
                onValueChange={(val) => setCategoryFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="training-filter-category"
                  size="sm"
                  className="w-48 rounded-lg bg-background text-xs"
                  aria-label="Filter Kategori Pelatihan"
                >
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Kategori</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="training-reset-filter"
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="rounded-lg">
                      <RotateCcw data-icon="inline-start" className="size-4" />
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
              onClick={loadAllData}
              aria-label="Muat ulang data"
              className="rounded-lg"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          }
        />
      </div>

      {/* Detail Slide-Over Sheet */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedTraining)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Program Pelatihan"
        description={
          selectedTraining
            ? `${selectedTraining.provider} · ${Number(
                selectedTraining.duration_hours || 0
              ).toFixed(1)} jam`
            : undefined
        }
        size="lg"
        loading={detailLoading}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDetailSheetOpen(false)}
              className="rounded-lg"
            >
              Tutup
            </Button>
            {selectedTraining && (
              <Button
                onClick={() => {
                  const target = selectedTraining;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
                className="rounded-lg"
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Pelatihan
              </Button>
            )}
          </>
        }
      >
        {selectedTraining && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedTraining.category}
                </Badge>
                {selectedScheduleMeta && (
                  <StatusBadge
                    tone={selectedScheduleMeta.tone}
                    label={selectedScheduleMeta.label}
                  />
                )}
              </div>
              <h4 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {selectedTraining.title}
              </h4>
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Penyelenggara</dt>
                <dd className="font-medium text-foreground">{selectedTraining.provider}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Durasi Pelatihan</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {Number(selectedTraining.duration_hours || 0).toFixed(1)} jam
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Tanggal Mulai</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {selectedTraining.start_date
                    ? String(selectedTraining.start_date).slice(0, 10)
                    : '-'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Tanggal Selesai</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {selectedTraining.end_date
                    ? String(selectedTraining.end_date).slice(0, 10)
                    : '-'}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-foreground">Peserta Terdaftar</h5>
                <Badge variant="outline" className="text-xs tabular-nums">
                  {selectedTraining.participations_count ??
                    selectedTraining.participations?.length ??
                    0}{' '}
                  peserta
                </Badge>
              </div>

              {selectedTraining.participations &&
              selectedTraining.participations.length > 0 ? (
                <ul className="divide-y divide-border">
                  {selectedTraining.participations.map((part) => {
                    const statusMeta = PARTICIPATION_STATUS_META[part.status] || {
                      status: part.status,
                      label: part.status,
                    };
                    const empName =
                      part.employee?.full_name || `Pegawai #${part.employee_id}`;
                    return (
                      <li
                        key={part.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-xs first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-8 border border-border">
                            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                              {getInitials(empName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-foreground">
                              {empName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {part.employee?.department?.name || '-'}
                            </span>
                          </div>
                        </div>
                        <StatusBadge
                          status={statusMeta.status}
                          tone={statusMeta.tone}
                          label={statusMeta.label}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada pegawai yang didaftarkan ke program pelatihan ini.
                </p>
              )}
            </div>
          </div>
        )}
      </FormSheet>

      {/* Create / Edit Training FormSheet */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={(open) => {
          if (!submitting) setFormSheetOpen(open);
        }}
        title={editingTraining ? 'Ubah Program Pelatihan' : 'Tambah Program Pelatihan'}
        description={
          editingTraining
            ? `Perbarui detail kurikulum dan jadwal untuk ${editingTraining.title}.`
            : 'Tambahkan program pelatihan baru ke katalog pengembangan kompetensi.'
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormSheetOpen(false)}
              disabled={submitting}
              className="rounded-lg"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="training-form"
              disabled={submitting}
              className="rounded-lg"
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingTraining
                  ? 'Simpan Perubahan'
                  : 'Simpan Pelatihan'}
            </Button>
          </>
        }
      >
        <form id="training-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="training-form-error"
                role="alert"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="training-title" className="text-xs font-medium">
                Judul Program Pelatihan
              </Label>
              <Input
                id="training-title"
                name="title"
                type="text"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Contoh: Manajemen Beban Kerja & Kepatuhan K3"
                className="rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="training-category" className="text-xs font-medium">
                  Kategori
                </Label>
                <Input
                  id="training-category"
                  name="category"
                  type="text"
                  required
                  maxLength={100}
                  list="training-category-options"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Teknis & Rekayasa"
                  className="rounded-lg"
                />
                <datalist id="training-category-options">
                  {categorySuggestions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="training-duration" className="text-xs font-medium">
                  Durasi (Jam)
                </Label>
                <Input
                  id="training-duration"
                  name="duration_hours"
                  type="number"
                  required
                  min="0.5"
                  max="1000"
                  step="0.5"
                  value={form.duration_hours}
                  onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                  className="rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="training-provider" className="text-xs font-medium">
                Penyelenggara / Provider
              </Label>
              <Input
                id="training-provider"
                name="provider"
                type="text"
                required
                maxLength={150}
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="Contoh: WorkBalance Tech Academy"
                className="rounded-lg"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="training-start-date" className="text-xs font-medium">
                Tanggal Mulai
              </Label>
              <Input
                id="training-start-date"
                name="start_date"
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="rounded-lg tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="training-end-date" className="text-xs font-medium">
                Tanggal Selesai
              </Label>
              <Input
                id="training-end-date"
                name="end_date"
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="rounded-lg tabular-nums"
              />
            </div>
          </div>
        </form>
      </FormSheet>

      {/* Delete Training ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deletingTraining)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingTraining(null);
        }}
        title="Hapus Program Pelatihan?"
        description={
          deletingTraining ? (
            <>
              Program pelatihan{' '}
              <span className="font-semibold text-foreground">{deletingTraining.title}</span> akan
              dihapus dari katalog.
              {Number(deletingTraining.participations_count || 0) > 0 && (
                <span className="mt-2.5 block rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800 tabular-nums">
                  Perhatian: Program ini masih memiliki {deletingTraining.participations_count}{' '}
                  peserta terdaftar. Penghapusan akan ditolak sistem untuk menjaga integritas data.
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel="Hapus"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
