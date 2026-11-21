import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import { trainingParticipationService } from '@/services/trainingParticipationService';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
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
    completion_date: new Date().toISOString().slice(0, 10),
  };
}

function EmployeeIdentity({ employee, showDepartment = false, compact = true }) {
  const emp = employee || {};
  const maxWidthClass = compact ? 'max-w-[180px]' : 'max-w-full';

  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 border border-border">
        <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
          {getInitials(emp.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span
          className={`${maxWidthClass} truncate ${
            compact ? 'text-xs' : 'text-sm'
          } font-medium text-foreground`}
        >
          {emp.full_name || '-'}
        </span>
        <span className={`${maxWidthClass} truncate text-xs text-muted-foreground tabular-nums`}>
          <span className="font-mono">{emp.employee_code || '-'}</span>
          {showDepartment && emp.department?.name ? ` · ${emp.department.name}` : ''}
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

  // --- Detail Handler ---
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

  // --- Create / Edit Handlers ---
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
        ? String(item.completion_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
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
    if (form.status === 'completed' && !form.completion_date) {
      setFormError('Tanggal kelulusan wajib diisi untuk peserta yang lulus.');
      return;
    }

    setSubmitting(true);

    const payload = {
      training_id: Number(form.training_id),
      employee_id: Number(form.employee_id),
      status: form.status,
      completion_date: form.status === 'completed' ? form.completion_date : null,
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

  // --- Delete Handler ---
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

  const columns = useMemo(
    () => [
      {
        accessorFn: (row) => row.employee?.full_name || '-',
        id: 'employee',
        header: 'Pegawai Peserta',
        cell: ({ row }) => (
          <EmployeeIdentity employee={row.original.employee} showDepartment compact />
        ),
      },
      {
        accessorFn: (row) => row.training?.title || '-',
        id: 'training',
        header: 'Program Pelatihan',
        cell: ({ row }) => {
          const training = row.original.training || {};
          return (
            <div className="flex max-w-[240px] flex-col gap-1 whitespace-normal">
              <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                {training.title || '-'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-xs font-normal">
                  {training.category || '-'}
                </Badge>
                {training.provider && (
                  <span className="max-w-[130px] truncate text-xs text-muted-foreground">
                    {training.provider}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.training?.duration_hours || 0),
        id: 'schedule',
        header: 'Durasi & Jadwal',
        cell: ({ row }) => {
          const training = row.original.training || {};
          const startDate = training.start_date
            ? String(training.start_date).slice(0, 10)
            : '-';
          const endDate = training.end_date
            ? String(training.end_date).slice(0, 10)
            : '-';
          return (
            <div className="flex flex-col text-xs whitespace-nowrap tabular-nums">
              <span className="font-medium text-foreground">
                {Number(training.duration_hours || 0).toFixed(1)} jam
              </span>
              <span className="text-xs text-muted-foreground">
                {startDate} s.d. {endDate}
              </span>
            </div>
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
        accessorFn: (row) =>
          row.completion_date ? String(row.completion_date).slice(0, 10) : '',
        id: 'completion_date',
        header: 'Tgl. Kelulusan',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {row.original.completion_date
              ? String(row.original.completion_date).slice(0, 10)
              : '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          const isCompleted = item.status === 'completed';

          return (
            <div className="-mr-1.5 flex items-center justify-end gap-1 whitespace-nowrap">
              {readOnly ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="rounded-lg"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDetailSheet(item);
                  }}
                >
                  <Eye className="size-4" data-icon="inline-start" />
                  Detail
                </Button>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Lihat detail keikutsertaan"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetailSheet(item);
                        }}
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Lihat detail keikutsertaan</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ubah status keikutsertaan"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditSheet(item);
                        }}
                      >
                        <Edit3 className="size-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ubah status keikutsertaan</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hapus pendaftaran"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeletingParticipation(item);
                        }}
                      >
                        <Trash2
                          className={
                            isCompleted
                              ? 'size-4 text-muted-foreground'
                              : 'size-4 text-destructive'
                          }
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isCompleted
                        ? 'Peserta sudah lulus (riwayat kelulusan dilindungi)'
                        : 'Hapus pendaftaran'}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [readOnly, openDetailSheet, openEditSheet]
  );

  const selectedStatusMeta = selectedParticipation
    ? getParticipationStatusMeta(selectedParticipation.status)
    : null;

  return (
    <AppShell
      title={readOnly ? 'Pelatihan Saya' : 'Partisipasi Pelatihan'}
      breadcrumb={readOnly ? 'Ruang Kerja' : 'Kesejahteraan'}
      actions={
        !readOnly ? (
          <Button size="sm" className="rounded-lg" onClick={openCreateSheet}>
            <Plus className="size-4" data-icon="inline-start" />
            Daftarkan Peserta
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-8">
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
                <Button variant="outline" size="sm" className="rounded-lg" onClick={resetFilters}>
                  <RotateCcw className="size-4" data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" className="rounded-lg" onClick={openCreateSheet}>
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
                  className="w-40 rounded-lg bg-background text-xs"
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
                      className="w-48 rounded-lg bg-background text-xs"
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
                      className="w-44 rounded-lg bg-background text-xs"
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
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg"
              onClick={loadAllData}
              aria-label="Muat ulang data"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
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
              className="rounded-lg"
              onClick={() => setDetailSheetOpen(false)}
            >
              Tutup
            </Button>
            {!readOnly && selectedParticipation && (
              <Button
                className="rounded-lg"
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
              <h4 className="text-base font-semibold tracking-[-0.015em] text-foreground">
                {selectedParticipation.training?.title || '-'}
              </h4>
              <p className="text-xs text-muted-foreground">
                Penyelenggara: {selectedParticipation.training?.provider || '-'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  {selectedParticipation.training?.start_date
                    ? String(selectedParticipation.training.start_date).slice(0, 10)
                    : '-'}{' '}
                  s.d.{' '}
                  {selectedParticipation.training?.end_date
                    ? String(selectedParticipation.training.end_date).slice(0, 10)
                    : '-'}
                </span>
              </div>
            </div>

            <Separator />

            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <dt className="text-xs text-muted-foreground">Pegawai Peserta</dt>
                <dd>
                  <EmployeeIdentity
                    employee={selectedParticipation.employee}
                    compact={false}
                  />
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Departemen &amp; Jabatan</dt>
                <dd className="text-sm font-medium text-foreground">
                  {selectedParticipation.employee?.department?.name || '-'}
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
                    ? String(selectedParticipation.completion_date).slice(0, 10)
                    : 'Belum selesai'}
                </dd>
              </div>
            </dl>
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
              className="rounded-lg"
              onClick={() => setFormSheetOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="training-participation-form"
              className="rounded-lg"
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
                className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp-training-id">Program Pelatihan</Label>
            <Select
              name="training_id"
              value={form.training_id || undefined}
              onValueChange={(val) => setForm((prev) => ({ ...prev, training_id: val }))}
            >
              <SelectTrigger id="tp-training-id" className="w-full rounded-lg bg-background">
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
            <Label htmlFor="tp-employee-id">Pegawai Peserta</Label>
            <Select
              name="employee_id"
              value={form.employee_id || undefined}
              onValueChange={(val) => setForm((prev) => ({ ...prev, employee_id: val }))}
            >
              <SelectTrigger id="tp-employee-id" className="w-full rounded-lg bg-background">
                <SelectValue placeholder="Pilih Pegawai Aktif" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {employeeOptions.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.full_name} ({emp.employee_code}) — {emp.department?.name || '-'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tp-status">Status Keikutsertaan</Label>
              <Select
                name="status"
                value={form.status}
                onValueChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
              >
                <SelectTrigger id="tp-status" className="w-full rounded-lg bg-background">
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
                <Label htmlFor="tp-completion-date">Tanggal Kelulusan</Label>
                <Input
                  id="tp-completion-date"
                  name="completion_date"
                  type="date"
                  required
                  value={form.completion_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, completion_date: e.target.value }))
                  }
                  className="rounded-lg bg-background tabular-nums"
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
                <span className="mt-2 block text-xs text-destructive">
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
