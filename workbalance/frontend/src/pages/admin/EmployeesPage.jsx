import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Edit3,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { getInitials, ROLE_LABELS } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ConfirmDialog,
  DataTable,
  FormSheet,
  KpiStatCard,
  StatusBadge,
} from '@/components/workbalance';

const ALL_FILTER_VALUE = '__all__';

function emptyEmployeeForm(departments, positions, employmentTypes) {
  return {
    employee_code: '',
    full_name: '',
    email: '',
    password: '',
    role: 'employee',
    department_id: departments[0]?.id ? String(departments[0].id) : '',
    position_id: positions[0]?.id ? String(positions[0].id) : '',
    employment_type_id: employmentTypes[0]?.id ? String(employmentTypes[0].id) : '',
    join_date: new Date().toISOString().slice(0, 10),
    status: 'active',
  };
}

function emptyTypeForm() {
  return {
    name: '',
    work_days_per_week: '5',
    normal_weekly_hours: '40',
  };
}

export default function EmployeesPage({ readOnly = false }) {
  const [activeTab, setActiveTab] = useState('employees');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    employment_types_count: 0,
  });
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Employee FormSheet State
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm([], [], []));
  const [employeeFormError, setEmployeeFormError] = useState('');
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);

  // Delete Employee ConfirmDialog State
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [deleteEmployeeLoading, setDeleteEmployeeLoading] = useState(false);

  // Employment Type FormSheet State
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm());
  const [typeFormError, setTypeFormError] = useState('');
  const [typeSubmitting, setTypeSubmitting] = useState(false);

  // Delete Employment Type ConfirmDialog State
  const [deletingType, setDeletingType] = useState(null);
  const [deleteTypeLoading, setDeleteTypeLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [empRes, typesRes, deptRes, posRes] = await Promise.all([
        employeeService.getEmployees({
          search,
          status: statusFilter === 'all' ? '' : statusFilter,
          department_id: departmentFilter,
          employment_type_id: typeFilter,
        }),
        employeeService.getEmploymentTypes(),
        employeeService.getDepartments(),
        employeeService.getPositions(),
      ]);

      setEmployees(empRes.employees || []);
      setSummary(
        empRes.summary || {
          total: 0,
          active: 0,
          inactive: 0,
          employment_types_count: (typesRes || []).length,
        }
      );
      setEmploymentTypes(typesRes || []);
      setDepartments(deptRes || []);
      setPositions(posRes || []);
      setHasLoaded(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat data master pegawai.').message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, typeFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter !== 'all' || departmentFilter || typeFilter),
    [search, statusFilter, departmentFilter, typeFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('');
    setTypeFilter('');
  };

  // --- Employee CRUD Handlers ---
  const openCreateEmployeeSheet = useCallback(() => {
    setEditingEmployee(null);
    setEmployeeForm(emptyEmployeeForm(departments, positions, employmentTypes));
    setEmployeeFormError('');
    setEmployeeSheetOpen(true);
  }, [departments, positions, employmentTypes]);

  const openEditEmployeeSheet = useCallback((emp) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      employee_code: emp.employee_code || '',
      full_name: emp.full_name || '',
      email: emp.user_account?.email || '',
      password: '',
      role: emp.user_account?.role || 'employee',
      department_id: String(emp.department_id || ''),
      position_id: String(emp.position_id || ''),
      employment_type_id: String(emp.employment_type_id || ''),
      join_date: emp.join_date ? String(emp.join_date).slice(0, 10) : '',
      status: emp.status || 'active',
    });
    setEmployeeFormError('');
    setEmployeeSheetOpen(true);
  }, []);

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setEmployeeFormError('');

    if (
      !employeeForm.department_id ||
      !employeeForm.position_id ||
      !employeeForm.employment_type_id
    ) {
      setEmployeeFormError('Departemen, jabatan, dan jenis kepegawaian wajib dipilih.');
      return;
    }

    setEmployeeSubmitting(true);

    const payload = {
      employee_code: employeeForm.employee_code.trim(),
      full_name: employeeForm.full_name.trim(),
      department_id: Number(employeeForm.department_id),
      position_id: Number(employeeForm.position_id),
      employment_type_id: Number(employeeForm.employment_type_id),
      join_date: employeeForm.join_date,
      status: employeeForm.status,
      role: employeeForm.role,
    };

    if (employeeForm.email.trim()) {
      payload.email = employeeForm.email.trim();
    }

    if (employeeForm.password.trim()) {
      payload.password = employeeForm.password.trim();
    }

    try {
      if (editingEmployee) {
        const res = await employeeService.updateEmployee(editingEmployee.id, payload);
        toast.success(res.message || 'Data pegawai berhasil diperbarui.');
      } else {
        const res = await employeeService.createEmployee(payload);
        toast.success(res.message || 'Data pegawai berhasil ditambahkan.');
      }
      setEmployeeSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setEmployeeFormError(extractApiError(err, 'Gagal menyimpan data pegawai.').message);
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setDeleteEmployeeLoading(true);

    try {
      const res = await employeeService.deleteEmployee(deletingEmployee.id);
      toast.success(res.message || 'Data pegawai berhasil dihapus.');
      setDeletingEmployee(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal menghapus pegawai.').message);
      setDeletingEmployee(null);
    } finally {
      setDeleteEmployeeLoading(false);
    }
  };

  // --- Employment Type CRUD Handlers ---
  const openCreateTypeSheet = useCallback(() => {
    setEditingType(null);
    setTypeForm(emptyTypeForm());
    setTypeFormError('');
    setTypeSheetOpen(true);
  }, []);

  const openEditTypeSheet = useCallback((typeItem) => {
    setEditingType(typeItem);
    setTypeForm({
      name: typeItem.name || '',
      work_days_per_week: String(typeItem.work_days_per_week || 5),
      normal_weekly_hours: String(typeItem.normal_weekly_hours || 40),
    });
    setTypeFormError('');
    setTypeSheetOpen(true);
  }, []);

  const handleTypeSubmit = async (e) => {
    e.preventDefault();
    setTypeSubmitting(true);
    setTypeFormError('');

    const payload = {
      name: typeForm.name.trim(),
      work_days_per_week: Number(typeForm.work_days_per_week),
      normal_weekly_hours: Number(typeForm.normal_weekly_hours),
    };

    try {
      if (editingType) {
        const res = await employeeService.updateEmploymentType(editingType.id, payload);
        toast.success(res.message || 'Jenis kepegawaian berhasil diperbarui.');
      } else {
        const res = await employeeService.createEmploymentType(payload);
        toast.success(res.message || 'Jenis kepegawaian berhasil ditambahkan.');
      }
      setTypeSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setTypeFormError(extractApiError(err, 'Gagal menyimpan jenis kepegawaian.').message);
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleConfirmDeleteType = async () => {
    if (!deletingType) return;
    setDeleteTypeLoading(true);

    try {
      const res = await employeeService.deleteEmploymentType(deletingType.id);
      toast.success(res.message || 'Jenis kepegawaian berhasil dihapus.');
      setDeletingType(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Jenis kepegawaian tidak dapat dihapus.').message);
      setDeletingType(null);
    } finally {
      setDeleteTypeLoading(false);
    }
  };

  // --- DataTable Columns: Employees ---
  const employeeColumns = useMemo(() => {
    const baseColumns = [
      {
        accessorFn: (row) => row.full_name || '',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original;
          const role = emp.user_account?.role;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                  {getInitials(emp.full_name, emp.user_account?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 max-w-[230px] flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {emp.full_name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {emp.user_account?.email || 'Tanpa akun login'}
                  {role && (
                    <span className="ml-1 font-medium text-primary">
                      ({ROLE_LABELS[role] || role})
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'employee_code',
        header: 'Kode',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {row.original.employee_code}
          </span>
        ),
      },
      {
        accessorFn: (row) => `${row.position?.title || ''} ${row.department?.name || ''}`,
        id: 'department_position',
        header: 'Departemen & Jabatan',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex max-w-[210px] flex-col gap-0.5 whitespace-normal">
              <span className="line-clamp-1 text-xs font-medium text-foreground">
                {emp.position?.title || '-'}
              </span>
              <span className="line-clamp-1 text-[11px] text-muted-foreground">
                {emp.department?.name || '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.employment_type?.name || '',
        id: 'employment_type',
        header: 'Jenis Kepegawaian',
        cell: ({ row }) => {
          const empType = row.original.employment_type;
          return (
            <div className="flex flex-col gap-0.5 whitespace-nowrap">
              <span className="text-xs font-medium text-foreground">{empType?.name || '-'}</span>
              {empType && (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {empType.work_days_per_week} hr · {empType.normal_weekly_hours}j/mg
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'join_date',
        header: 'Tgl Bergabung',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {row.original.join_date ? String(row.original.join_date).slice(0, 10) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge status={row.original.status === 'active' ? 'active' : 'inactive'} />
        ),
      },
    ];

    if (!readOnly) {
      baseColumns.push({
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditEmployeeSheet(emp);
                }}
                aria-label={`Ubah ${emp.full_name}`}
                title="Ubah Pegawai"
                className="text-muted-foreground hover:text-primary"
              >
                <Edit3 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingEmployee(emp);
                }}
                aria-label={`Hapus ${emp.full_name}`}
                title="Hapus Pegawai"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [readOnly, openEditEmployeeSheet]);

  // --- DataTable Columns: Employment Types ---
  const typeColumns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'name',
        header: 'Nama Jenis Kepegawaian',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'work_days_per_week',
        header: 'Hari Kerja / Minggu',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground whitespace-nowrap tabular-nums">
            {row.original.work_days_per_week} hari/minggu
          </span>
        ),
      },
      {
        accessorFn: (row) => (Number(row.work_days_per_week) === 6 ? 7 : 8),
        id: 'daily_overtime_limit',
        header: 'Ambang Lembur Harian',
        cell: ({ row }) => {
          const dailyLimit = Number(row.original.work_days_per_week) === 6 ? 7 : 8;
          return (
            <span className="font-mono text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              &gt; {dailyLimit} jam/hari (PP 35/2021)
            </span>
          );
        },
      },
      {
        accessorKey: 'normal_weekly_hours',
        header: 'Jam Normal / Minggu',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
            {row.original.normal_weekly_hours} jam
          </span>
        ),
      },
      {
        accessorFn: (row) => Number(row.employees_count || 0),
        id: 'employees_count',
        header: 'Pegawai Terkait',
        cell: ({ row }) => {
          const count = Number(row.original.employees_count || 0);
          const inUse = count > 0;
          return (
            <Badge
              variant={inUse ? 'secondary' : 'outline'}
              className="gap-1 font-mono text-xs font-medium whitespace-nowrap tabular-nums"
              title={
                inUse
                  ? 'Tidak dapat dihapus karena masih direferensikan oleh data pegawai aktif'
                  : 'Belum digunakan oleh pegawai'
              }
            >
              {inUse && <Lock className="size-3 text-muted-foreground" />}
              {count} pegawai
            </Badge>
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
          const typeItem = row.original;
          const inUse = Number(typeItem.employees_count || 0) > 0;
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditTypeSheet(typeItem);
                }}
                aria-label={`Ubah ${typeItem.name}`}
                title="Ubah Jenis Kepegawaian"
                className="text-muted-foreground hover:text-primary"
              >
                <Edit3 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingType(typeItem);
                }}
                aria-label={`Hapus ${typeItem.name}`}
                title={
                  inUse
                    ? 'Masih digunakan oleh pegawai (penghapusan ditolak sistem)'
                    : 'Hapus Jenis Kepegawaian'
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
  }, [readOnly, openEditTypeSheet]);

  const activePercent =
    summary.total > 0 ? Math.round((Number(summary.active || 0) / summary.total) * 100) : 0;

  return (
    <AppShell
      title={readOnly ? 'Direktori Pegawai Tim' : 'Manajemen Pegawai & Kepegawaian'}
      breadcrumb={
        readOnly
          ? 'Organisasi & Tim / Direktori Tim'
          : 'Master Organisasi / Pegawai & Kepegawaian'
      }
      actions={
        readOnly ? (
          <Badge variant="outline" className="gap-1.5 text-xs font-normal text-muted-foreground">
            <Lock className="size-3" />
            Mode Baca Saja
          </Badge>
        ) : activeTab === 'employees' ? (
          <Button size="sm" onClick={openCreateEmployeeSheet}>
            <Plus data-icon="inline-start" />
            Tambah Pegawai
          </Button>
        ) : (
          <Button size="sm" onClick={openCreateTypeSheet}>
            <Plus data-icon="inline-start" />
            Tambah Jenis Kepegawaian
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
              label="Total Pegawai"
              value={summary.total}
              unit="pegawai"
              icon={Users}
              hint="Seluruh unit organisasi"
            />

            <KpiStatCard
              label="Pegawai Aktif"
              value={summary.active}
              unit="pegawai"
              icon={UserCheck}
              status="active"
              statusLabel="Beroperasi"
              hint={`${activePercent}% dari total`}
            />

            <KpiStatCard
              label="Pegawai Nonaktif"
              value={summary.inactive}
              unit="pegawai"
              icon={UserMinus}
              status={Number(summary.inactive || 0) > 0 ? 'inactive' : 'active'}
              statusLabel={
                Number(summary.inactive || 0) > 0 ? 'Akses dinonaktifkan' : 'Semua aktif'
              }
            />

            <KpiStatCard
              label="Jenis Kepegawaian"
              value={summary.employment_types_count}
              unit="kategori"
              icon={Briefcase}
              hint="Acuan jam kerja normal"
            />
          </section>
        )}

        {/* Row 2: Tabs (Data Master Pegawai / Jenis Kepegawaian) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="employees" className="px-3">
                Data Master Pegawai
              </TabsTrigger>
              <TabsTrigger value="employment-types" className="px-3">
                Jenis Kepegawaian
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Data Master Pegawai */}
          <TabsContent value="employees">
            <DataTable
              title="Daftar Pegawai"
              countLabel="pegawai"
              columns={employeeColumns}
              data={employees}
              loading={loading}
              error={errorMsg}
              onRetry={loadAllData}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Cari nama, kode, atau email..."
              pageSize={10}
              emptyTitle={
                hasActiveFilters
                  ? 'Tidak ada pegawai yang sesuai filter'
                  : 'Belum ada data pegawai'
              }
              emptyDescription={
                hasActiveFilters
                  ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
                  : 'Tambahkan data pegawai pertama untuk mulai memantau kondisi kerja tim.'
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
                    <Button size="sm" onClick={openCreateEmployeeSheet}>
                      <Plus data-icon="inline-start" />
                      Tambah Pegawai
                    </Button>
                  )}
                </div>
              }
              filterSlot={
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={statusFilter}
                    onValueChange={(val) => val && setStatusFilter(val)}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="all" className="text-xs">
                      Semua
                    </ToggleGroupItem>
                    <ToggleGroupItem value="active" className="text-xs">
                      Aktif
                    </ToggleGroupItem>
                    <ToggleGroupItem value="inactive" className="text-xs">
                      Nonaktif
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Select
                    name="filter_department"
                    value={departmentFilter || ALL_FILTER_VALUE}
                    onValueChange={(val) =>
                      setDepartmentFilter(val === ALL_FILTER_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger
                      id="emp-filter-department"
                      size="sm"
                      className="w-44 bg-background text-xs"
                      aria-label="Filter Departemen"
                    >
                      <SelectValue placeholder="Semua Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_FILTER_VALUE}>Semua Departemen</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    name="filter_employment_type"
                    value={typeFilter || ALL_FILTER_VALUE}
                    onValueChange={(val) =>
                      setTypeFilter(val === ALL_FILTER_VALUE ? '' : val)
                    }
                  >
                    <SelectTrigger
                      id="emp-filter-type"
                      size="sm"
                      className="w-44 bg-background text-xs"
                      aria-label="Filter Jenis Kepegawaian"
                    >
                      <SelectValue placeholder="Semua Kepegawaian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_FILTER_VALUE}>Semua Kepegawaian</SelectItem>
                        {employmentTypes.map((typeItem) => (
                          <SelectItem key={typeItem.id} value={String(typeItem.id)}>
                            {typeItem.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

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
          </TabsContent>

          {/* Tab 2: Jenis Kepegawaian */}
          <TabsContent value="employment-types">
            <DataTable
              title="Daftar Jenis Kepegawaian"
              countLabel="kategori"
              columns={typeColumns}
              data={employmentTypes}
              loading={loading}
              error={errorMsg}
              onRetry={loadAllData}
              searchable
              searchPlaceholder="Cari jenis kepegawaian..."
              pageSize={10}
              emptyTitle="Belum ada jenis kepegawaian"
              emptyDescription="Tambahkan kategori hubungan kerja untuk menetapkan standar hari dan jam kerja normal."
              emptyAction={
                !readOnly ? (
                  <Button size="sm" onClick={openCreateTypeSheet}>
                    <Plus data-icon="inline-start" />
                    Tambah Jenis Kepegawaian
                  </Button>
                ) : undefined
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
          </TabsContent>
        </Tabs>
      </div>

      {/* FormSheet: Create / Edit Employee */}
      <FormSheet
        open={employeeSheetOpen}
        onOpenChange={(open) => {
          if (!employeeSubmitting) setEmployeeSheetOpen(open);
        }}
        title={editingEmployee ? 'Ubah Data Pegawai' : 'Tambah Pegawai Baru'}
        description={
          editingEmployee
            ? `Perbarui profil kepegawaian dan akses akun untuk ${editingEmployee.full_name}.`
            : 'Daftarkan profil pegawai baru beserta akun login dan peran aksesnya.'
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmployeeSheetOpen(false)}
              disabled={employeeSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" form="employee-form" disabled={employeeSubmitting}>
              {employeeSubmitting && <Spinner data-icon="inline-start" />}
              {employeeSubmitting
                ? 'Menyimpan...'
                : editingEmployee
                  ? 'Simpan Perubahan'
                  : 'Simpan Pegawai'}
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={handleEmployeeSubmit} className="flex flex-col gap-4">
          {employeeFormError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{employeeFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-code" className="text-xs font-medium">
                Kode Pegawai
              </Label>
              <Input
                id="emp-code"
                name="employee_code"
                type="text"
                required
                value={employeeForm.employee_code}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, employee_code: e.target.value })
                }
                placeholder="EMP-006"
                className="font-mono tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-full-name" className="text-xs font-medium">
                Nama Lengkap
              </Label>
              <Input
                id="emp-full-name"
                name="full_name"
                type="text"
                required
                value={employeeForm.full_name}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, full_name: e.target.value })
                }
                placeholder="Nama lengkap pegawai"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-department" className="text-xs font-medium">
                Departemen
              </Label>
              <Select
                name="department_id"
                value={employeeForm.department_id || undefined}
                onValueChange={(val) =>
                  setEmployeeForm({ ...employeeForm, department_id: val })
                }
              >
                <SelectTrigger id="emp-department" className="w-full">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-position" className="text-xs font-medium">
                Jabatan / Posisi
              </Label>
              <Select
                name="position_id"
                value={employeeForm.position_id || undefined}
                onValueChange={(val) => setEmployeeForm({ ...employeeForm, position_id: val })}
              >
                <SelectTrigger id="emp-position" className="w-full">
                  <SelectValue placeholder="Pilih Jabatan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-type" className="text-xs font-medium">
                Jenis Kepegawaian
              </Label>
              <Select
                name="employment_type_id"
                value={employeeForm.employment_type_id || undefined}
                onValueChange={(val) =>
                  setEmployeeForm({ ...employeeForm, employment_type_id: val })
                }
              >
                <SelectTrigger id="emp-type" className="w-full">
                  <SelectValue placeholder="Pilih Jenis Kepegawaian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employmentTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-join-date" className="text-xs font-medium">
                Tanggal Bergabung
              </Label>
              <Input
                id="emp-join-date"
                name="join_date"
                type="date"
                required
                value={employeeForm.join_date}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, join_date: e.target.value })
                }
                className="font-mono tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-email" className="text-xs font-medium">
                Email Akun
              </Label>
              <Input
                id="emp-email"
                name="email"
                type="email"
                autoComplete="off"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="pegawai@workbalance.id"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-password" className="text-xs font-medium">
                {editingEmployee ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi Awal'}
              </Label>
              <Input
                id="emp-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={employeeForm.password}
                onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                placeholder={
                  editingEmployee
                    ? 'Kosongkan jika tetap'
                    : 'Min. 8 karakter (default password123)'
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-role" className="text-xs font-medium">
                Peran Akses (RBAC)
              </Label>
              <Select
                name="role"
                value={employeeForm.role}
                onValueChange={(val) => setEmployeeForm({ ...employeeForm, role: val })}
              >
                <SelectTrigger id="emp-role" className="w-full">
                  <SelectValue placeholder="Pilih Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="employee">Pegawai</SelectItem>
                    <SelectItem value="manager">Manajer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-status" className="text-xs font-medium">
                Status Keaktifan
              </Label>
              <Select
                name="status"
                value={employeeForm.status}
                onValueChange={(val) => setEmployeeForm({ ...employeeForm, status: val })}
              >
                <SelectTrigger id="emp-status" className="w-full">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
      </FormSheet>

      {/* ConfirmDialog: Delete Employee */}
      <ConfirmDialog
        open={Boolean(deletingEmployee)}
        onOpenChange={(open) => {
          if (!open && !deleteEmployeeLoading) setDeletingEmployee(null);
        }}
        title="Hapus Data Pegawai?"
        description={
          deletingEmployee ? (
            <>
              Data pegawai{' '}
              <span className="font-semibold text-foreground">{deletingEmployee.full_name}</span> (
              <span className="font-mono tabular-nums">{deletingEmployee.employee_code}</span>)
              beserta akun login terkait akan dihapus secara permanen.
            </>
          ) : undefined
        }
        confirmLabel="Hapus Pegawai"
        variant="destructive"
        loading={deleteEmployeeLoading}
        onConfirm={handleConfirmDeleteEmployee}
      />

      {/* FormSheet: Create / Edit Employment Type */}
      <FormSheet
        open={typeSheetOpen}
        onOpenChange={(open) => {
          if (!typeSubmitting) setTypeSheetOpen(open);
        }}
        title={editingType ? 'Ubah Jenis Kepegawaian' : 'Tambah Jenis Kepegawaian'}
        description="Tetapkan standar hari kerja dan jam kerja normal mingguan sesuai PP No. 35/2021."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTypeSheetOpen(false)}
              disabled={typeSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" form="employment-type-form" disabled={typeSubmitting}>
              {typeSubmitting && <Spinner data-icon="inline-start" />}
              {typeSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <form id="employment-type-form" onSubmit={handleTypeSubmit} className="flex flex-col gap-4">
          {typeFormError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{typeFormError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type-name" className="text-xs font-medium">
              Nama Jenis Kepegawaian
            </Label>
            <Input
              id="type-name"
              name="name"
              type="text"
              required
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              placeholder="Misal: Tetap (PKWTT)"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type-work-days" className="text-xs font-medium">
                Hari Kerja / Minggu
              </Label>
              <Select
                name="work_days_per_week"
                value={typeForm.work_days_per_week}
                onValueChange={(val) => setTypeForm({ ...typeForm, work_days_per_week: val })}
              >
                <SelectTrigger id="type-work-days" className="w-full">
                  <SelectValue placeholder="Pilih Hari Kerja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="5">5 Hari (8 jam/hari)</SelectItem>
                    <SelectItem value="6">6 Hari (7 jam/hari)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type-weekly-hours" className="text-xs font-medium">
                Jam Normal / Minggu
              </Label>
              <Input
                id="type-weekly-hours"
                name="normal_weekly_hours"
                type="number"
                min={1}
                max={80}
                required
                value={typeForm.normal_weekly_hours}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, normal_weekly_hours: e.target.value })
                }
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </form>
      </FormSheet>

      {/* ConfirmDialog: Delete Employment Type */}
      <ConfirmDialog
        open={Boolean(deletingType)}
        onOpenChange={(open) => {
          if (!open && !deleteTypeLoading) setDeletingType(null);
        }}
        title="Hapus Jenis Kepegawaian?"
        description={
          deletingType ? (
            <>
              Anda akan menghapus kategori{' '}
              <span className="font-semibold text-foreground">{deletingType.name}</span>.
              {Number(deletingType.employees_count || 0) > 0 && (
                <span className="mt-2.5 block rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
                  Perhatian: Jenis kepegawaian ini masih digunakan oleh{' '}
                  {deletingType.employees_count} pegawai. Sistem akan menolak penghapusan untuk
                  menjaga integritas data.
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel="Hapus"
        variant="destructive"
        loading={deleteTypeLoading}
        onConfirm={handleConfirmDeleteType}
      />
    </AppShell>
  );
}
