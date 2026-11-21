import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Edit3,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

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
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [departments, setDepartments] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState('all');

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

    const apiManagerFilter = managerFilter === 'all' ? '' : managerFilter;
    const hasFilters = Boolean(search.trim() || apiManagerFilter);

    try {
      const [filteredDepts, unfilteredDepts, empRes] = await Promise.all([
        departmentService.getDepartments({
          search: search.trim(),
          has_manager: apiManagerFilter,
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

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || managerFilter !== 'all'),
    [search, managerFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setManagerFilter('all');
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
      const res = await departmentService.deleteDepartment(deletingDepartment.id);
      toast.success(res.message || 'Data departemen berhasil dihapus.');
      setDeletingDepartment(null);
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
          <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground whitespace-nowrap tabular-nums">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Departemen',
        cell: ({ row }) => {
          const dept = row.original;
          return (
            <div className="flex max-w-[260px] flex-col gap-0.5 whitespace-normal">
              <span className="font-medium text-foreground">{dept.name}</span>
              <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                {dept.description || 'Belum ada deskripsi departemen.'}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.manager?.full_name || '',
        id: 'manager',
        header: 'Manajer Departemen',
        cell: ({ row }) => {
          const manager = row.original.manager;
          if (!manager) {
            return <StatusBadge tone="warning" label="Belum Ditentukan" />;
          }
          return (
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                  {getInitials(manager.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 max-w-[220px] flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {manager.full_name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{manager.employee_code}</span>
                  {manager.position?.title ? ` · ${manager.position.title}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.employees_count || 0),
        id: 'employees_count',
        header: 'Pegawai Terkait',
        cell: ({ row }) => {
          const employeesCount = Number(row.original.employees_count || 0);
          const activeCount = Number(row.original.active_employees_count || 0);
          return (
            <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
              <Badge
                variant={employeesCount > 0 ? 'secondary' : 'outline'}
                className="gap-1 font-mono text-xs font-medium tabular-nums"
                title={
                  employeesCount > 0
                    ? 'Tidak dapat dihapus karena masih memiliki pegawai terdaftar'
                    : 'Belum memiliki pegawai terdaftar'
                }
              >
                {employeesCount > 0 && <Lock className="size-3 text-muted-foreground" />}
                {employeesCount} pegawai
              </Badge>
              {employeesCount > 0 && (
                <span className="pl-1 text-[11px] text-muted-foreground tabular-nums">
                  {activeCount} aktif
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorFn: (row) => Number(row.tasks_count || 0),
        id: 'tasks_count',
        header: 'Tugas Terkait',
        cell: ({ row }) => {
          const tasksCount = Number(row.original.tasks_count || 0);
          return (
            <span className="font-mono text-xs font-medium text-muted-foreground whitespace-nowrap tabular-nums">
              {tasksCount} tugas
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
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditSheet(dept);
                }}
                aria-label={`Ubah ${dept.name}`}
                title="Ubah Departemen"
                className="text-muted-foreground hover:text-primary"
              >
                <Edit3 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingDepartment(dept);
                }}
                aria-label={`Hapus ${dept.name}`}
                title={
                  inUse
                    ? 'Masih memiliki relasi aktif (penghapusan ditolak sistem)'
                    : 'Hapus Departemen'
                }
                className={
                  inUse
                    ? 'text-muted-foreground/60 hover:text-amber-700'
                    : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                }
              >
                <Trash2 />
              </Button>
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [readOnly, openEditSheet]);

  return (
    <AppShell
      title={readOnly ? 'Struktur Departemen Organisasi' : 'Manajemen Data Departemen'}
      breadcrumb={
        readOnly
          ? 'Organisasi & Tim / Struktur Departemen'
          : 'Master Organisasi / Data Departemen'
      }
      actions={
        readOnly ? (
          <Badge variant="outline" className="gap-1.5 text-xs font-normal text-muted-foreground">
            <Lock className="size-3" />
            Mode Baca Saja
          </Badge>
        ) : (
          <Button size="sm" onClick={openCreateSheet}>
            <Plus data-icon="inline-start" />
            Tambah Departemen
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {/* Row 1: 4 KPI Summary Cards */}
        {loading && !hasLoaded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label="Total Departemen"
              value={stats.totalDepartments}
              unit="unit"
              icon={Building2}
              hint="Unit struktur organisasi"
            />

            <KpiStatCard
              label="Departemen Dengan Manajer"
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
              label="Total Pegawai Terkelompok"
              value={stats.totalEmployees}
              unit="pegawai"
              icon={Users}
              hint="Tersebar di seluruh unit"
            />

            <KpiStatCard
              label="Rata-rata Pegawai / Unit"
              value={stats.avgEmployees}
              unit="pegawai"
              icon={Building2}
              mono
              hint="Kepadatan anggota departemen"
            />
          </section>
        )}

        {/* Row 2: Department DataTable */}
        <DataTable
          title="Daftar Departemen"
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
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada departemen yang sesuai filter'
              : 'Belum ada data departemen'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
              : 'Tambahkan unit departemen untuk mengelompokkan pegawai dan analisis Decent Work Score.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Setel Ulang Filter
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" onClick={openCreateSheet}>
                  <Plus data-icon="inline-start" />
                  Tambah Departemen
                </Button>
              )}
            </div>
          }
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                value={managerFilter}
                onValueChange={(val) => val && setManagerFilter(val)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="all" className="text-xs">
                  Semua
                </ToggleGroupItem>
                <ToggleGroupItem value="with_manager" className="text-xs">
                  Memiliki Manajer
                </ToggleGroupItem>
                <ToggleGroupItem value="without_manager" className="text-xs">
                  Belum Ada Manajer
                </ToggleGroupItem>
              </ToggleGroup>

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
              onClick={loadAllData}
              aria-label="Muat ulang data"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          }
        />
      </div>

      {/* Create / Edit Department Slide-Over FormSheet */}
      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!submitting) setSheetOpen(open);
        }}
        title={editingDepartment ? 'Ubah Data Departemen' : 'Tambah Departemen Baru'}
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
            >
              Batal
            </Button>
            <Button type="submit" form="department-form" disabled={submitting}>
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
        <form id="department-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

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
                className="font-mono tabular-nums"
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
              />
            </div>
          </div>

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
              <SelectTrigger id="dept-manager" className="w-full">
                <SelectValue placeholder="Belum Ditentukan" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_MANAGER_VALUE}>Belum Ditentukan</SelectItem>
                  {managerOptions.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.full_name} ({emp.employee_code})
                      {emp.position?.title ? ` — ${emp.position.title}` : ''}
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
            />
          </div>
        </form>
      </FormSheet>

      {/* Delete Department ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deletingDepartment)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingDepartment(null);
        }}
        title="Hapus Data Departemen?"
        description={
          deletingDepartment ? (
            <>
              Anda akan menghapus departemen{' '}
              <span className="font-semibold text-foreground">{deletingDepartment.name}</span> (
              <span className="font-mono tabular-nums">{deletingDepartment.code}</span>).
              {(Number(deletingDepartment.employees_count || 0) > 0 ||
                Number(deletingDepartment.tasks_count || 0) > 0) && (
                <span className="mt-2.5 block rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
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
