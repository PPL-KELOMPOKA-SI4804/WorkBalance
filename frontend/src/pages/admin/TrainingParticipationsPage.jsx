import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatDate, toApiDate, toISODateLocal } from '@/lib/format';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import { trainingParticipationService } from '@/services/trainingParticipationService';
import { trainingService } from '@/services/trainingService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DatePicker,
  FormSheet,
  KpiStatCard,
  RowActionsMenu,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';

const PARTICIPATION_STATUS_META = {
  enrolled: { status: 'enrolled', tone: 'info', label: 'Terdaftar' },
  completed: { status: 'completed', tone: 'success', label: 'Lulus' },
  dropped: { status: 'cancelled', tone: 'danger', label: 'Batal / Mundur' },
};

function getParticipationStatusMeta(status) {
  return PARTICIPATION_STATUS_META[status] || PARTICIPATION_STATUS_META.enrolled;
}

function emptyParticipationForm(trainings = [], employees = []) {
  return {
    training_id: trainings[0]?.id ? String(trainings[0].id) : '',
    employee_id: employees[0]?.id ? String(employees[0].id) : '',
    status: 'enrolled',
    completion_date: toISODateLocal(),
  };
}

function EmployeeDetailIdentity({ employee }) {
  const emp = employee || {};

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
          <span className="font-mono font-normal">{emp.employee_code || '-'}</span>
        </span>
      </div>
    </div>
  );
}

export default function TrainingParticipationsPage({ readOnly = false }) {
  const prefersReducedMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [participations, setParticipations] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    enrolled: 0,
    completed: 0,
    dropped: 0,
    trained_employees_count: 0,
    training_coverage_rate: 0,
  });

  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trainingFilter, setTrainingFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Detail Sheet State
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState(null);

  // Create / Edit Sheet State
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingParticipation, setEditingParticipation] = useState(null);
  const [form, setForm] = useState(() => emptyParticipationForm([], []));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Dialog State
  const [deletingParticipation, setDeletingParticipation] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [partRes, trainingsRes, empRes, deptRes] = await Promise.all([
        trainingParticipationService.getTrainingParticipations({
          search: search.trim(),
          status: statusFilter,
          training_id: !readOnly ? trainingFilter : '',
          department_id: !readOnly ? departmentFilter : '',
        }),
        !readOnly ? trainingService.getTrainings() : Promise.resolve(null),
        !readOnly ? employeeService.getEmployees({ status: 'active' }) : Promise.resolve(null),
        !readOnly ? departmentService.getDepartments() : Promise.resolve(null),
      ]);

      setParticipations(partRes?.participations || []);
      setSummary(
        partRes?.summary || {
          total: 0,
          enrolled: 0,
          completed: 0,
          dropped: 0,
          trained_employees_count: 0,
          training_coverage_rate: 0,
        }
      );

      if (!readOnly) {
        setTrainings(trainingsRes?.trainings || []);
        setEmployees(empRes?.employees || []);
        setDepartments(deptRes || []);
      }
    } catch (err) {
      setErrorMsg(
        extractApiError(err, 'Gagal memuat data keikutsertaan pelatihan.').message
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, trainingFilter, departmentFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useRefetchOnFocus(loadAllData);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || trainingFilter || departmentFilter),
    [search, statusFilter, trainingFilter, departmentFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTrainingFilter('');
    setDepartmentFilter('');
  };

  const trainingOptions = useMemo(() => {
    if (
      editingParticipation?.training &&
      !trainings.some((t) => String(t.id) === String(editingParticipation.training_id))
    ) {
      return [editingParticipation.training, ...trainings];
    }
    return trainings;
  }, [trainings, editingParticipation]);

  const employeeOptions = useMemo(() => {
    if (
      editingParticipation?.employee &&
      !employees.some((e) => String(e.id) === String(editingParticipation.employee_id))
    ) {
      return [editingParticipation.employee, ...employees];
    }
    return employees;
  }, [employees, editingParticipation]);

  // Detail Handler
  const openDetailSheet = useCallback(async (item) => {
    setSelectedParticipation(item);
    setDetailSheetOpen(true);
    setDetailLoading(true);

    try {
      const detail = await trainingParticipationService.getTrainingParticipation(item.id);
      setSelectedParticipation(detail);
    } catch (err) {
      toast.error(
        extractApiError(err, 'Gagal memuat detail keikutsertaan pelatihan.').message
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Create / Edit Handlers
  const openCreateSheet = useCallback(() => {
    setEditingParticipation(null);
    setForm(emptyParticipationForm(trainings, employees));
    setFormError('');
    setFormSheetOpen(true);
  }, [trainings, employees]);

  const openEditSheet = useCallback((item) => {
    setEditingParticipation(item);
    setForm({
      training_id: String(item.training_id || ''),
      employee_id: String(item.employee_id || ''),
      status: item.status || 'enrolled',
      completion_date: item.completion_date
        ? toApiDate(item.completion_date)
        : toISODateLocal(),
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.training_id) {
      setFormError('Program pelatihan wajib dipilih.');
      return;
    }
    if (!form.employee_id) {
      setFormError('Pegawai peserta wajib dipilih.');
      return;
    }

    const normalizedCompletionDate =
      form.status === 'completed' ? toApiDate(form.completion_date) : null;

    if (form.status === 'completed' && !normalizedCompletionDate) {
      setFormError('Tanggal kelulusan wajib diisi untuk peserta yang lulus.');
      return;
    }

    setSubmitting(true);

    const payload = {
      training_id: Number(form.training_id),
      employee_id: Number(form.employee_id),
      status: form.status,
      completion_date: normalizedCompletionDate,
    };

    try {
      if (editingParticipation) {
        const res = await trainingParticipationService.updateTrainingParticipation(
          editingParticipation.id,
          payload
        );
        toast.success(
          res.message || 'Status keikutsertaan pelatihan berhasil diperbarui.'
        );
      } else {
        const res = await trainingParticipationService.createTrainingParticipation(payload);
        toast.success(
          res.message || 'Pegawai berhasil didaftarkan ke program pelatihan.'
        );
      }
      setFormSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(
        extractApiError(err, 'Gagal menyimpan data keikutsertaan pelatihan.').message
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingParticipation) return;
    setDeleteLoading(true);

    try {
      const res = await trainingParticipationService.deleteTrainingParticipation(
        deletingParticipation.id
      );
      toast.success(res.message || 'Data keikutsertaan pelatihan berhasil dihapus.');
      setDeletingParticipation(null);
      await loadAllData();
    } catch (err) {
      toast.error(
        extractApiError(err, 'Data keikutsertaan pelatihan tidak dapat dihapus.').message
      );
      setDeletingParticipation(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const coverageRate = Number(summary.training_coverage_rate || 0);

  const columns = useMemo(() => {
    const cols = [];

    if (!readOnly) {
      cols.push({
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original.employee || {};
          const name = emp.full_name || '-';
          return (
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              <Avatar className="size-7 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <span
                className="max-w-[180px] truncate text-xs font-medium text-foreground"
                title={name}
              >
                {name}
              </span>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        accessorFn: (row) => row.training?.title || '-',
        id: 'training',
        header: 'Program',
        cell: ({ row }) => {
          const title = row.original.training?.title || '-';
          return (
            <span
              className="block max-w-[260px] truncate text-xs font-medium text-foreground"
              title={title}
            >
              {title}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const meta = getParticipationStatusMeta(row.original.status);
          return (
            <div className="whitespace-nowrap">
              <StatusBadge status={meta.status} tone={meta.tone} label={meta.label} />
            </div>
          );
        },
      },
      {
        accessorFn: (row) => toApiDate(row.completion_date) || '',
        id: 'completion_date',
        header: 'Tgl Lulus',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {formatDate(row.original.completion_date)}
          </span>
        ),
      }
    );

    if (!readOnly) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          const isCompleted = item.status === 'completed';

          return (
            <RowActionsMenu
              ariaLabel="Aksi partisipasi pelatihan"
              items={[
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditSheet(item),
                },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  title: isCompleted
                    ? 'Peserta sudah lulus (riwayat kelulusan dilindungi)'
                    : 'Hapus pendaftaran',
                  onSelect: () => setDeletingParticipation(item),
                },
              ]}
            />
          );
        },
      });
    }

    return cols;
  }, [readOnly, openEditSheet]);

  const selectedStatusMeta = selectedParticipation
    ? getParticipationStatusMeta(selectedParticipation.status)
    : null;

  const detailNotes =
    selectedParticipation?.notes || selectedParticipation?.training?.description || '';

  return (
    <AppShell
      title={readOnly ? 'Pelatihan Saya' : 'Partisipasi Pelatihan'}
      breadcrumb={readOnly ? 'Ruang Kerja' : 'Kesejahteraan'}
    >
      <div className="flex flex-col gap-6">
        {/* Row 1: 4 KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Total Partisipasi"
              value={summary.total ?? 0}
              unit="pendaftaran"
              hint="Seluruh program"
            />

            <KpiStatCard
              label="Sedang Berlangsung"
              value={summary.enrolled ?? 0}
              unit="peserta"
              status="enrolled"
              statusLabel="Terdaftar"
            />

            <KpiStatCard
              label="Lulus Pelatihan"
              value={summary.completed ?? 0}
              unit="lulus"
              status="completed"
              statusLabel="Lulus"
            />

            <KpiStatCard
              label={readOnly ? 'Tingkat Kelulusan' : 'Cakupan Terlatih'}
              value={`${coverageRate.toFixed(1)}%`}
              statusTone={coverageRate >= 75 ? 'success' : 'warning'}
              statusLabel={
                readOnly
                  ? `${summary.completed ?? 0} program lulus`
                  : `${summary.trained_employees_count ?? 0} pegawai terlatih`
              }
            />
          </section>
        )}

        {/* Row 2: Participations DataTable */}
        <DataTable
          title="Riwayat Partisipasi"
          countLabel="peserta"
          columns={columns}
          data={participations}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama, kode, atau pelatihan..."
          pageSize={10}
          onRowClick={(row) => openDetailSheet(row)}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada data sesuai filter'
              : 'Belum ada pendaftaran pelatihan'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Ubah kata kunci pencarian atau setel ulang filter untuk melihat data peserta pelatihan.'
              : readOnly
                ? 'Anda belum terdaftar pada program pelatihan mana pun saat ini.'
                : 'Daftarkan pegawai ke program pelatihan untuk memantau perkembangan dan kelulusan kompetensi.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={resetFilters}>
                  <RotateCcw className="size-4" data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              {!readOnly && (
                <Button variant="cta" size="sm" className="rounded-xl" onClick={openCreateSheet}>
                  <Plus className="size-4" data-icon="inline-start" />
                  Daftarkan Peserta
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="filter_status"
                value={statusFilter || ALL_VALUE}
                onValueChange={(val) => setStatusFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="tp-filter-status"
                  size="sm"
                  aria-label="Filter Status Partisipasi"
                  className="h-9 w-40 rounded-xl bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="enrolled">Terdaftar</SelectItem>
                    <SelectItem value="completed">Lulus</SelectItem>
                    <SelectItem value="dropped">Batal / Mundur</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {!readOnly && (
                <>
                  <Select
                    name="filter_training_id"
                    value={trainingFilter || ALL_VALUE}
                    onValueChange={(val) =>
                      setTrainingFilter(val === ALL_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger
                      id="tp-filter-training"
                      size="sm"
                      aria-label="Filter Program Pelatihan"
                      className="h-9 w-48 rounded-xl bg-background text-xs"
                    >
                      <SelectValue placeholder="Semua Pelatihan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Pelatihan</SelectItem>
                        {trainings.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    name="filter_department_id"
                    value={departmentFilter || ALL_VALUE}
                    onValueChange={(val) =>
                      setDepartmentFilter(val === ALL_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger
                      id="tp-filter-department"
                      size="sm"
                      aria-label="Filter Departemen"
                      className="h-9 w-44 rounded-xl bg-background text-xs"
                    >
                      <SelectValue placeholder="Semua Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </>
              )}

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="tp-reset-filters"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
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
            !readOnly ? (
              <Button variant="cta" size="sm" className="rounded-xl" onClick={openCreateSheet}>
                <Plus className="size-4" data-icon="inline-start" />
                Daftarkan Peserta
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Sheet 1: Detail Keikutsertaan */}
      <FormSheet
        open={detailSheetOpen && Boolean(selectedParticipation)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Partisipasi Pelatihan"
        description={selectedParticipation?.training?.title || undefined}
        size="md"
        loading={detailLoading}
        footer={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDetailSheetOpen(false)}
            >
              Tutup
            </Button>
            {!readOnly && selectedParticipation && (
              <Button
                variant="cta"
                className="rounded-xl"
                onClick={() => {
                  const target = selectedParticipation;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 className="size-4" data-icon="inline-start" />
                Ubah Status
              </Button>
            )}
          </>
        }
      >
        {selectedParticipation && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {selectedStatusMeta && (
                  <StatusBadge
                    status={selectedStatusMeta.status}
                    tone={selectedStatusMeta.tone}
                    label={selectedStatusMeta.label}
                  />
                )}
                <Badge variant="secondary" className="text-xs font-normal">
                  {selectedParticipation.training?.category || '-'}
                </Badge>
              </div>
              <h4 className="text-base font-bold tracking-[-0.02em] text-foreground">
                {selectedParticipation.training?.title || '-'}
              </h4>
              <p className="text-xs text-muted-foreground">
                Penyelenggara: {selectedParticipation.training?.provider || '-'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  {formatDate(selectedParticipation.training?.start_date)} s.d.{' '}
                  {formatDate(selectedParticipation.training?.end_date)}
                </span>
              </div>
            </div>

            <Separator />

            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <dt className="text-xs text-muted-foreground">Pegawai Peserta</dt>
                <dd>
                  <EmployeeDetailIdentity employee={selectedParticipation.employee} />
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Departemen &amp; Jabatan</dt>
                <dd className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                  {selectedParticipation.employee?.department?.code && (
                    <Badge variant="outline" className="font-mono text-xs font-normal">
                      {selectedParticipation.employee.department.code}
                    </Badge>
                  )}
                  <span>{selectedParticipation.employee?.department?.name || '-'}</span>
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {selectedParticipation.employee?.position?.title || '-'}
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Durasi Program</dt>
                <dd className="text-sm font-semibold text-foreground tabular-nums">
                  {Number(selectedParticipation.training?.duration_hours || 0).toFixed(1)} jam
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Tanggal Kelulusan</dt>
                <dd className="text-sm font-semibold text-foreground tabular-nums">
                  {selectedParticipation.completion_date
                    ? formatDate(selectedParticipation.completion_date)
                    : 'Belum selesai'}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Catatan</span>
              <p
                className={
                  detailNotes
                    ? 'text-sm leading-relaxed whitespace-pre-wrap text-foreground'
                    : 'text-sm leading-relaxed text-muted-foreground'
                }
              >
                {detailNotes || 'Tidak ada catatan tambahan.'}
              </p>
            </div>
          </div>
        )}
      </FormSheet>

      {/* Sheet 2: Tambah / Ubah Keikutsertaan */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        title={
          editingParticipation
            ? 'Ubah Status Partisipasi'
            : 'Daftarkan Peserta Pelatihan'
        }
        description="Pilih program pelatihan, pegawai peserta, serta status kelulusan kompetensi."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFormSheetOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="cta"
              form="training-participation-form"
              className="rounded-xl"
              disabled={submitting}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingParticipation
                  ? 'Simpan Perubahan'
                  : 'Daftarkan Peserta'}
            </Button>
          </>
        }
      >
        <form
          id="training-participation-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="tp-form-error"
                role="alert"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-xs text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp-training-id" className="text-xs font-semibold">
              Program Pelatihan <span className="text-danger">*</span>
            </Label>
            <Select
              name="training_id"
              value={form.training_id || undefined}
              onValueChange={(val) => setForm((prev) => ({ ...prev, training_id: val }))}
            >
              <SelectTrigger id="tp-training-id" className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Pilih Program Pelatihan" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {trainingOptions.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.title} ({Number(t.duration_hours || 0).toFixed(1)}j)
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp-employee-id" className="text-xs font-semibold">
              Pegawai Peserta <span className="text-danger">*</span>
            </Label>
            <Select
              name="employee_id"
              value={form.employee_id || undefined}
              onValueChange={(val) => setForm((prev) => ({ ...prev, employee_id: val }))}
            >
              <SelectTrigger id="tp-employee-id" className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Pilih Pegawai Aktif" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {employeeOptions.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {emp.employee_code || '-'}
                        </span>
                        <span>
                          {emp.full_name}
                          {emp.department?.name ? ` (${emp.department.name})` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tp-status" className="text-xs font-semibold">
                Status Keikutsertaan <span className="text-danger">*</span>
              </Label>
              <Select
                name="status"
                value={form.status}
                onValueChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
              >
                <SelectTrigger id="tp-status" className="h-10 w-full rounded-xl bg-background">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="enrolled">Terdaftar (Enrolled)</SelectItem>
                    <SelectItem value="completed">Lulus (Completed)</SelectItem>
                    <SelectItem value="dropped">Batal / Mundur (Dropped)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {form.status === 'completed' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tp-completion-date" className="text-xs font-semibold">
                  Tanggal Kelulusan <span className="text-danger">*</span>
                </Label>
                <DatePicker
                  id="tp-completion-date"
                  ariaLabel="Tanggal Kelulusan"
                  value={form.completion_date}
                  onChange={(val) =>
                    setForm((prev) => ({ ...prev, completion_date: val }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            )}
          </div>
        </form>
      </FormSheet>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deletingParticipation)}
        onOpenChange={(open) => {
          if (!open) setDeletingParticipation(null);
        }}
        title="Hapus Data Partisipasi?"
        description={
          deletingParticipation ? (
            <>
              Pendaftaran{' '}
              <span className="font-semibold text-foreground">
                {deletingParticipation.employee?.full_name}
              </span>{' '}
              pada pelatihan{' '}
              <span className="font-semibold text-foreground">
                {deletingParticipation.training?.title}
              </span>{' '}
              akan dihapus.
              {deletingParticipation.status === 'completed' && (
                <span className="mt-2 block text-xs text-danger">
                  Perhatian: Peserta sudah berstatus Lulus (Completed). Penghapusan akan
                  ditolak sistem untuk menjaga riwayat kompetensi pegawai.
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel={deleteLoading ? 'Memproses...' : 'Hapus'}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
