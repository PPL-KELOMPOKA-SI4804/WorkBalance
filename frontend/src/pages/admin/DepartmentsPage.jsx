import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  RowActionsMenu,
  StatusBadge,
} from '@/components/workbalance';

const ALL_VALUE = '__all__';
const NO_MANAGER_VALUE = '__none__';

function emptyDepartmentForm() {
  return {
    code: '',
    name: '',
    manager_id: '',
    description: '',
  };
}

export default function DepartmentsPage({ readOnly = false }) {
  const shouldReduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [departments, setDepartments] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState('');

  // Detail Slide-Over Sheet State
  const [detailDepartment, setDetailDepartment] = useState(null);

  // Create/Edit Slide-Over Sheet State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form, setForm] = useState(emptyDepartmentForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Dialog State
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    const hasFilters = Boolean(search.trim() || managerFilter);

    try {
      const [filteredDepts, unfilteredDepts, empRes] = await Promise.all([
        departmentService.getDepartments({
          search: search.trim(),
          has_manager: managerFilter,
        }),
        hasFilters ? departmentService.getDepartments() : Promise.resolve(null),
        !readOnly
          ? employeeService.getEmployees({ status: 'active' })
          : Promise.resolve({ employees: [] }),
      ]);

      const deptList = filteredDepts || [];
      setDepartments(deptList);
      setAllDepartments(unfilteredDepts || deptList);
      setActiveEmployees(empRes?.employees || []);
      setHasLoaded(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data departemen organisasi.').message);
    } finally {
      setLoading(false);
    }
  }, [search, managerFilter, readOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useRefetchOnFocus(loadAllData);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || managerFilter),
    [search, managerFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setManagerFilter('');
  };

  const stats = useMemo(() => {
    const totalDepartments = allDepartments.length;
    const withManager = allDepartments.filter((dept) => Boolean(dept.manager_id)).length;
    const withoutManager = totalDepartments - withManager;
    const totalEmployees = allDepartments.reduce(
      (sum, dept) => sum + Number(dept.employees_count || 0),
      0
    );
    const avgEmployees =
      totalDepartments > 0 ? (totalEmployees / totalDepartments).toFixed(1) : '0.0';

    return {
      totalDepartments,
      withManager,
      withoutManager,
      totalEmployees,
      avgEmployees,
    };
  }, [allDepartments]);

  const managerOptions = useMemo(() => {
    if (!editingDepartment?.manager) {
      return activeEmployees;
    }

    const exists = activeEmployees.some((emp) => emp.id === editingDepartment.manager.id);
    if (exists) {
      return activeEmployees;
    }

    return [editingDepartment.manager, ...activeEmployees];
  }, [activeEmployees, editingDepartment]);

  const openCreateSheet = useCallback(() => {
    setEditingDepartment(null);
    setForm(emptyDepartmentForm());
    setFormError('');
    setSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((dept) => {
    setEditingDepartment(dept);
    setForm({
      code: dept.code || '',
      name: dept.name || '',
      manager_id: dept.manager_id ? String(dept.manager_id) : '',
      description: dept.description || '',
    });
    setFormError('');
    setSheetOpen(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      description: form.description.trim() || null,
    };

    try {
      if (editingDepartment) {
        const res = await departmentService.updateDepartment(editingDepartment.id, payload);
        toast.success(res.message || 'Data departemen berhasil diperbarui.');
      } else {
        const res = await departmentService.createDepartment(payload);
        toast.success(res.message || 'Data departemen berhasil ditambahkan.');
      }
      setSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(extractApiError(err, 'Gagal menyimpan data departemen.').message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDepartment) return;
    setDeleteLoading(true);

    try {
      const targetId = deletingDepartment.id;
      const res = await departmentService.deleteDepartment(targetId);
      toast.success(res.message || 'Data departemen berhasil dihapus.');
      setDeletingDepartment(null);
      setDetailDepartment((prev) => (prev?.id === targetId ? null : prev));
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Departemen tidak dapat dihapus.').message);
      setDeletingDepartment(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'code',
        header: 'Kode',
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-normal text-foreground whitespace-nowrap">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Departemen',
        cell: ({ row }) => (
          <span
            className="block max-w-[260px] truncate text-sm font-medium text-foreground"
            title={row.original.name}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.manager?.full_name || '',
        id: 'manager',
        header: 'Manajer',
        meta: { className: 'hidden sm:table-cell' },
        cell: ({ row }) => {
          const manager = row.original.manager;
          if (!manager) {
            return <StatusBadge tone="warning" label="Belum Ditentukan" />;
          }
          return (
            <span
              className="block max-w-[200px] truncate text-sm text-foreground"
              title={manager.full_name}
            >
              {manager.full_name}
            </span>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.employees_count || 0),
        id: 'employees_count',
        header: 'Pegawai',
        cell: ({ row }) => {
          const employeesCount = Number(row.original.employees_count || 0);
          return (
            <span className="text-sm font-medium text-foreground whitespace-nowrap tabular-nums">
              {employeesCount} pegawai
            </span>
          );
        },
      },
    ];

    if (!readOnly) {
      baseColumns.push({
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const dept = row.original;
          const inUse =
            Number(dept.employees_count || 0) > 0 || Number(dept.tasks_count || 0) > 0;
          return (
            <RowActionsMenu
              ariaLabel={`Aksi untuk ${dept.name}`}
              items={[
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditSheet(dept),
                },
                { type: 'separator' },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  title: inUse
                    ? 'Masih memiliki relasi aktif (penghapusan ditolak sistem)'
                    : 'Hapus Departemen',
                  onSelect: () => setDeletingDepartment(dept),
                },
              ]}
            />
          );
        },
      });
    }

    return baseColumns;
  }, [readOnly, openEditSheet]);

  return (
    <AppShell
      title={readOnly ? 'Struktur Departemen' : 'Departemen'}
      breadcrumb={readOnly ? 'Organisasi' : 'Master Data'}
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
              label="Total Departemen"
              value={stats.totalDepartments}
              unit="unit"
              icon={Building2}
              hint="Unit organisasi"
            />

            <KpiStatCard
              label="Dengan Manajer"
              value={stats.withManager}
              unit={`/ ${stats.totalDepartments}`}
              icon={UserCheck}
              status={
                stats.totalDepartments > 0 && stats.withoutManager === 0 ? 'active' : 'pending'
              }
              statusLabel={
                stats.totalDepartments > 0 && stats.withoutManager === 0
                  ? 'Terisi penuh'
                  : `${stats.withoutManager} belum ada`
              }
            />

            <KpiStatCard
              label="Pegawai Terkelompok"
              value={stats.totalEmployees}
              unit="pegawai"
              icon={Users}
              hint="Seluruh departemen"
            />

            <KpiStatCard
              label="Rata-rata / Unit"
              value={stats.avgEmployees}
              unit="pegawai"
              icon={Building2}
              hint="Rasio per departemen"
            />
          </section>
        )}

        {/* Row 2: Department DataTable */}
        <DataTable
          title="Departemen"
          countLabel="departemen"
          columns={columns}
          data={departments}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari kode, nama, atau manajer..."
          pageSize={10}
          onRowClick={(dept) => setDetailDepartment(dept)}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada departemen yang sesuai filter'
              : 'Belum ada departemen'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
              : 'Tambahkan unit departemen untuk mengelompokkan pegawai dan analisis Decent Work Score.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="rounded-lg">
                  <RotateCcw data-icon="inline-start" className="size-4" />
                  Setel Ulang Filter
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" onClick={openCreateSheet} className="rounded-lg">
                  <Plus data-icon="inline-start" className="size-4" />
                  Tambah Departemen
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="filter_manager"
                value={managerFilter || ALL_VALUE}
                onValueChange={(val) => setManagerFilter(val === ALL_VALUE ? '' : val)}
              >
                <SelectTrigger
                  id="dept-filter-manager"
                  size="sm"
                  className="w-44 rounded-lg bg-background text-xs"
                  aria-label="Filter Status Manajer"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="with_manager">Memiliki Manajer</SelectItem>
                    <SelectItem value="without_manager">Belum Ada Manajer</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="dept-reset-filter"
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
            !readOnly ? (
              <Button size="sm" onClick={openCreateSheet} className="rounded-lg">
                <Plus data-icon="inline-start" className="size-4" />
                Tambah Departemen
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Detail Department Slide-Over FormSheet */}
      <FormSheet
        open={Boolean(detailDepartment)}
        onOpenChange={(open) => {
          if (!open) setDetailDepartment(null);
        }}
        title="Detail Departemen"
        description={detailDepartment ? `Ringkasan struktur unit ${detailDepartment.name}.` : undefined}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailDepartment(null)}
              className="rounded-lg"
            >
              Tutup
            </Button>
            {!readOnly && detailDepartment && (
              <Button
                type="button"
                onClick={() => {
                  const target = detailDepartment;
                  setDetailDepartment(null);
                  openEditSheet(target);
                }}
                className="rounded-lg"
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Departemen
              </Button>
            )}
          </>
        }
      >
        {detailDepartment && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-normal text-foreground">
                  {detailDepartment.code}
                </span>
                <StatusBadge
                  tone={detailDepartment.manager ? 'success' : 'warning'}
                  label={detailDepartment.manager ? 'Memiliki Manajer' : 'Belum Ada Manajer'}
                />
              </div>
              <h4 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {detailDepartment.name}
              </h4>
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Kode Departemen</dt>
                <dd className="font-mono text-sm font-normal text-foreground">
                  {detailDepartment.code}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Total Pegawai</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {Number(detailDepartment.employees_count || 0)} pegawai
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Pegawai Aktif</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {Number(detailDepartment.active_employees_count || 0)} aktif
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Tugas Terkait</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {Number(detailDepartment.tasks_count || 0)} tugas
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-2.5">
              <h5 className="text-xs font-semibold text-foreground">Manajer Departemen</h5>
              {detailDepartment.manager ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                  <Avatar className="size-9 shrink-0 border border-border">
                    <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                      {getInitials(detailDepartment.manager.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {detailDepartment.manager.full_name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono font-normal tabular-nums">
                        {detailDepartment.manager.employee_code}
                      </span>
                      {detailDepartment.manager.position?.title
                        ? ` · ${detailDepartment.manager.position.title}`
                        : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <StatusBadge tone="warning" label="Belum Ditentukan" />
                </div>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <h5 className="text-xs font-semibold text-foreground">Deskripsi Unit / Fungsi</h5>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {detailDepartment.description || 'Belum ada deskripsi departemen.'}
              </p>
            </div>
          </div>
        )}
      </FormSheet>

      {/* Create / Edit Department Slide-Over FormSheet */}
      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!submitting) setSheetOpen(open);
        }}
        title={editingDepartment ? 'Ubah Departemen' : 'Tambah Departemen'}
        description={
          editingDepartment
            ? `Perbarui informasi kode, manajer, atau deskripsi untuk ${editingDepartment.name}.`
            : 'Tambahkan unit departemen baru ke struktur organisasi.'
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={submitting}
              className="rounded-lg"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="department-form"
              disabled={submitting}
              className="rounded-lg"
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting
                ? 'Menyimpan...'
                : editingDepartment
                  ? 'Simpan Perubahan'
                  : 'Simpan Departemen'}
            </Button>
          </>
        }
      >
        <form id="department-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="department-form-error"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-code" className="text-xs font-medium">
                Kode Departemen
              </Label>
              <Input
                id="dept-code"
                name="code"
                type="text"
                required
                maxLength={30}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="FIN"
                className="rounded-lg tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="dept-name" className="text-xs font-medium">
                Nama Departemen
              </Label>
              <Input
                id="dept-name"
                name="name"
                type="text"
                required
                maxLength={150}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Keuangan & Akuntansi"
                className="rounded-lg"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-manager" className="text-xs font-medium">
                Manajer Departemen (Opsional)
              </Label>
              <Select
                name="manager_id"
                value={form.manager_id || NO_MANAGER_VALUE}
                onValueChange={(val) =>
                  setForm({ ...form, manager_id: val === NO_MANAGER_VALUE ? '' : val })
                }
              >
                <SelectTrigger id="dept-manager" className="w-full rounded-lg">
                  <SelectValue placeholder="Belum Ditentukan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_MANAGER_VALUE}>Belum Ditentukan</SelectItem>
                    {managerOptions.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.full_name} ({emp.employee_code})
                        {emp.position?.title ? ` · ${emp.position.title}` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-description" className="text-xs font-medium">
                Deskripsi Unit / Fungsi (Opsional)
              </Label>
              <Textarea
                id="dept-description"
                name="description"
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ringkasan ruang lingkup tanggung jawab departemen..."
                className="rounded-lg"
              />
            </div>
          </div>
        </form>
      </FormSheet>

      {/* Delete Department ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deletingDepartment)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingDepartment(null);
        }}
        title="Hapus Departemen?"
        description={
          deletingDepartment ? (
            <>
              Anda akan menghapus departemen{' '}
              <span className="font-semibold text-foreground">{deletingDepartment.name}</span> (
              <span className="font-mono font-normal tabular-nums">{deletingDepartment.code}</span>
              ).
              {(Number(deletingDepartment.employees_count || 0) > 0 ||
                Number(deletingDepartment.tasks_count || 0) > 0) && (
                <span className="mt-2.5 block rounded-xl border border-warning-border bg-warning-subtle px-3.5 py-2.5 text-xs text-warning tabular-nums">
                  Perhatian: Departemen ini masih memiliki{' '}
                  {deletingDepartment.employees_count || 0} pegawai dan{' '}
                  {deletingDepartment.tasks_count || 0} tugas terkait. Sistem akan menolak
                  penghapusan untuk menjaga integritas data.
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
