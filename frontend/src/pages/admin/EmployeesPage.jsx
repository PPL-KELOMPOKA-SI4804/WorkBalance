import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatDate, toApiDate, toISODateLocal } from '@/lib/format';
import { getInitials, ROLE_LABELS } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    join_date: toISODateLocal(),
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

function getDailyOvertimeThreshold(typeItem) {
  if (typeItem?.max_daily_hours !== undefined && typeItem?.max_daily_hours !== null) {
    return Number(typeItem.max_daily_hours);
  }
  return Number(typeItem?.work_days_per_week) === 6 ? 7 : 8;
}

export default function EmployeesPage({ readOnly = false }) {
  const shouldReduceMotion = useReducedMotion();

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
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Detail FormSheet State
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [detailType, setDetailType] = useState(null);

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
          status: statusFilter,
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

  useRefetchOnFocus(loadAllData);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || departmentFilter || typeFilter),
    [search, statusFilter, departmentFilter, typeFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDepartmentFilter('');
    setTypeFilter('');
  };

  // Employee CRUD Handlers
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
      join_date: toApiDate(emp.join_date),
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

    const joinDate = toApiDate(employeeForm.join_date);
    if (!joinDate) {
      setEmployeeFormError('Tanggal bergabung wajib dipilih.');
      return;
    }

    setEmployeeSubmitting(true);

    const payload = {
      employee_code: employeeForm.employee_code.trim(),
      full_name: employeeForm.full_name.trim(),
      department_id: Number(employeeForm.department_id),
      position_id: Number(employeeForm.position_id),
      employment_type_id: Number(employeeForm.employment_type_id),
      join_date: joinDate,
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
      const targetId = deletingEmployee.id;
      const res = await employeeService.deleteEmployee(targetId);
      toast.success(res.message || 'Data pegawai berhasil dihapus.');
      setDeletingEmployee(null);
      setDetailEmployee((prev) => (prev?.id === targetId ? null : prev));
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Gagal menghapus pegawai.').message);
      setDeletingEmployee(null);
    } finally {
      setDeleteEmployeeLoading(false);
    }
  };

  // Employment Type CRUD Handlers
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
      const targetId = deletingType.id;
      const res = await employeeService.deleteEmploymentType(targetId);
      toast.success(res.message || 'Jenis kepegawaian berhasil dihapus.');
      setDeletingType(null);
      setDetailType((prev) => (prev?.id === targetId ? null : prev));
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Jenis kepegawaian tidak dapat dihapus.').message);
      setDeletingType(null);
    } finally {
      setDeleteTypeLoading(false);
    }
  };

  // DataTable Columns: Employees
  const employeeColumns = useMemo(() => {
    const baseColumns = [
      {
        accessorFn: (row) => row.full_name || '',
        id: 'employee',
        header: 'Pegawai',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(emp.full_name, emp.user_account?.email)}
                </AvatarFallback>
              </Avatar>
              <span
                className="max-w-[200px] truncate text-sm font-medium text-foreground"
                title={emp.full_name}
              >
                {emp.full_name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'employee_code',
        header: 'Kode',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-normal text-foreground whitespace-nowrap tabular-nums">
            {row.original.employee_code}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.department?.name || '',
        id: 'department',
        header: 'Departemen',
        meta: { className: 'hidden md:table-cell' },
        cell: ({ row }) => {
          const deptName = row.original.department?.name || '-';
          return (
            <span
              className="block max-w-[200px] truncate text-sm text-muted-foreground"
              title={deptName}
            >
              {deptName}
            </span>
          );
        },
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
            <RowActionsMenu
              ariaLabel={`Aksi untuk ${emp.full_name}`}
              items={[
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditEmployeeSheet(emp),
                },
                { type: 'separator' },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  onSelect: () => setDeletingEmployee(emp),
                },
              ]}
            />
          );
        },
      });
    }

    return baseColumns;
  }, [readOnly, openEditEmployeeSheet]);

  // DataTable Columns: Employment Types
  const typeColumns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'name',
        header: 'Nama',
        cell: ({ row }) => (
          <span
            className="block max-w-[220px] truncate text-sm font-medium text-foreground"
            title={row.original.name}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'work_days_per_week',
        header: 'Hari/Minggu',
        cell: ({ row }) => (
          <span className="text-sm text-foreground whitespace-nowrap tabular-nums">
            {row.original.work_days_per_week} hari/minggu
          </span>
        ),
      },
      {
        accessorKey: 'normal_weekly_hours',
        header: 'Jam Normal',
        meta: { className: 'hidden sm:table-cell' },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground whitespace-nowrap tabular-nums">
            {row.original.normal_weekly_hours} jam/minggu
          </span>
        ),
      },
      {
        accessorFn: (row) => Number(row.employees_count || 0),
        id: 'employees_count',
        header: 'Pegawai',
        cell: ({ row }) => {
          const count = Number(row.original.employees_count || 0);
          return (
            <span className="text-sm font-medium text-foreground whitespace-nowrap tabular-nums">
              {count} pegawai
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
          const typeItem = row.original;
          const inUse = Number(typeItem.employees_count || 0) > 0;
          return (
            <RowActionsMenu
              ariaLabel={`Aksi untuk ${typeItem.name}`}
              items={[
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  onSelect: () => openEditTypeSheet(typeItem),
                },
                { type: 'separator' },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  title: inUse
                    ? 'Masih digunakan oleh pegawai (penghapusan ditolak sistem)'
                    : 'Hapus Jenis Kepegawaian',
                  onSelect: () => setDeletingType(typeItem),
                },
              ]}
            />
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
      title={readOnly ? 'Direktori Pegawai' : 'Pegawai'}
      breadcrumb={readOnly ? 'Organisasi' : 'Master Data'}
    >
      <div className="flex flex-col gap-6">
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
              label="Total Pegawai"
              value={summary.total}
              unit="pegawai"
              icon={Users}
              hint="Seluruh unit"
            />

            <KpiStatCard
              label="Pegawai Aktif"
              value={summary.active}
              unit="pegawai"
              icon={UserCheck}
              status="active"
              statusLabel={`${activePercent}% dari total`}
            />

            <KpiStatCard
              label="Pegawai Nonaktif"
              value={summary.inactive}
              unit="pegawai"
              icon={UserMinus}
              status={Number(summary.inactive || 0) > 0 ? 'inactive' : 'active'}
              statusLabel={Number(summary.inactive || 0) > 0 ? 'Akses nonaktif' : 'Semua aktif'}
            />

            <KpiStatCard
              label="Jenis Kepegawaian"
              value={summary.employment_types_count}
              unit="kategori"
              icon={Briefcase}
              hint="Standar jam kerja"
            />
          </section>
        )}

        {/* Row 2: Tabs (Pegawai / Jenis Kepegawaian) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="employees" className="px-3">
                Pegawai
              </TabsTrigger>
              <TabsTrigger value="employment-types" className="px-3">
                Jenis Kepegawaian
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Pegawai */}
          <TabsContent value="employees">
            <DataTable
              title="Pegawai"
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
              onRowClick={(emp) => setDetailEmployee(emp)}
              emptyTitle={
                hasActiveFilters
                  ? 'Tidak ada pegawai yang sesuai filter'
                  : 'Belum ada pegawai'
              }
              emptyDescription={
                hasActiveFilters
                  ? 'Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.'
                  : 'Tambahkan data pegawai pertama untuk mulai memantau kondisi kerja tim.'
              }
              emptyAction={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="h-9 rounded-xl"
                    >
                      <RotateCcw data-icon="inline-start" className="size-4" />
                      Setel Ulang Filter
                    </Button>
                  )}
                  {!readOnly && (
                    <Button
                      variant="cta"
                      size="sm"
                      onClick={openCreateEmployeeSheet}
                      className="h-9 rounded-xl px-3.5"
                    >
                      <Plus data-icon="inline-start" className="size-4" />
                      Tambah Pegawai
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
                      id="emp-filter-status"
                      className="h-9 w-36 rounded-xl bg-background text-xs data-[size=default]:h-9"
                      aria-label="Filter Status Pegawai"
                    >
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Nonaktif</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    name="filter_department"
                    value={departmentFilter || ALL_VALUE}
                    onValueChange={(val) => setDepartmentFilter(val === ALL_VALUE ? '' : val)}
                  >
                    <SelectTrigger
                      id="emp-filter-department"
                      className="h-9 w-44 rounded-xl bg-background text-xs data-[size=default]:h-9"
                      aria-label="Filter Departemen"
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

                  <Select
                    name="filter_employment_type"
                    value={typeFilter || ALL_VALUE}
                    onValueChange={(val) => setTypeFilter(val === ALL_VALUE ? '' : val)}
                  >
                    <SelectTrigger
                      id="emp-filter-type"
                      className="h-9 w-44 rounded-xl bg-background text-xs data-[size=default]:h-9"
                      aria-label="Filter Jenis Kepegawaian"
                    >
                      <SelectValue placeholder="Semua Kepegawaian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ALL_VALUE}>Semua Kepegawaian</SelectItem>
                        {employmentTypes.map((typeItem) => (
                          <SelectItem key={typeItem.id} value={String(typeItem.id)}>
                            {typeItem.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <AnimatePresence initial={false}>
                    {hasActiveFilters && (
                      <motion.div
                        key="emp-reset-filter"
                        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetFilters}
                          className="h-9 rounded-xl"
                        >
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
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={openCreateEmployeeSheet}
                    className="h-9 rounded-xl px-3.5"
                  >
                    <Plus data-icon="inline-start" className="size-4" />
                    Tambah Pegawai
                  </Button>
                ) : undefined
              }
            />
          </TabsContent>

          {/* Tab 2: Jenis Kepegawaian */}
          <TabsContent value="employment-types">
            <DataTable
              title="Jenis Kepegawaian"
              countLabel="kategori"
              columns={typeColumns}
              data={employmentTypes}
              loading={loading}
              error={errorMsg}
              onRetry={loadAllData}
              searchable
              searchPlaceholder="Cari jenis kepegawaian..."
              pageSize={10}
              onRowClick={(typeItem) => setDetailType(typeItem)}
              emptyTitle="Belum ada jenis kepegawaian"
              emptyDescription="Tambahkan kategori hubungan kerja untuk menetapkan standar hari dan jam kerja normal."
              emptyAction={
                !readOnly ? (
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={openCreateTypeSheet}
                    className="h-9 rounded-xl px-3.5"
                  >
                    <Plus data-icon="inline-start" className="size-4" />
                    Tambah Jenis Kepegawaian
                  </Button>
                ) : undefined
              }
              actionsSlot={
                !readOnly ? (
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={openCreateTypeSheet}
                    className="h-9 rounded-xl px-3.5"
                  >
                    <Plus data-icon="inline-start" className="size-4" />
                    Tambah Jenis Kepegawaian
                  </Button>
                ) : undefined
              }
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* FormSheet: Employee Detail */}
      <FormSheet
        open={Boolean(detailEmployee)}
        onOpenChange={(open) => {
          if (!open) setDetailEmployee(null);
        }}
        title="Detail Pegawai"
        description={
          detailEmployee ? `Profil kepegawaian dan informasi akun ${detailEmployee.full_name}.` : undefined
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailEmployee(null)}
              className="rounded-xl"
            >
              Tutup
            </Button>
            {!readOnly && detailEmployee && (
              <Button
                type="button"
                variant="cta"
                onClick={() => {
                  const target = detailEmployee;
                  setDetailEmployee(null);
                  openEditEmployeeSheet(target);
                }}
                className="rounded-xl"
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Pegawai
              </Button>
            )}
          </>
        }
      >
        {detailEmployee && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-11 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                  {getInitials(detailEmployee.full_name, detailEmployee.user_account?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-base font-bold tracking-[-0.02em] text-foreground">
                    {detailEmployee.full_name}
                  </h4>
                  <StatusBadge
                    status={detailEmployee.status === 'active' ? 'active' : 'inactive'}
                  />
                </div>
                <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
                  {detailEmployee.employee_code}
                </span>
              </div>
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Departemen</dt>
                <dd className="font-medium text-foreground">
                  {detailEmployee.department?.name || '-'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Jabatan / Posisi</dt>
                <dd className="font-medium text-foreground">
                  {detailEmployee.position?.title || '-'}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Jenis Kepegawaian</dt>
                <dd className="font-medium text-foreground">
                  {detailEmployee.employment_type?.name || '-'}
                  {detailEmployee.employment_type && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground tabular-nums">
                      {detailEmployee.employment_type.work_days_per_week} hari/minggu ·{' '}
                      {detailEmployee.employment_type.normal_weekly_hours} jam/minggu
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Tanggal Bergabung</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {formatDate(detailEmployee.join_date)}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-3">
              <h5 className="text-xs font-semibold text-foreground">Akun &amp; Akses</h5>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Email Akun</dt>
                  <dd className="break-all font-medium text-foreground">
                    {detailEmployee.user_account?.email || 'Tanpa akun login'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Status Akun / Peran</dt>
                  <dd className="font-medium text-foreground">
                    {detailEmployee.user_account?.role
                      ? ROLE_LABELS[detailEmployee.user_account.role] ||
                        detailEmployee.user_account.role
                      : 'Belum memiliki akun'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </FormSheet>

      {/* FormSheet: Employment Type Detail */}
      <FormSheet
        open={Boolean(detailType)}
        onOpenChange={(open) => {
          if (!open) setDetailType(null);
        }}
        title="Detail Jenis Kepegawaian"
        description="Standar hari kerja dan ambang lembur harian sesuai PP No. 35/2021."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailType(null)}
              className="rounded-xl"
            >
              Tutup
            </Button>
            {!readOnly && detailType && (
              <Button
                type="button"
                variant="cta"
                onClick={() => {
                  const target = detailType;
                  setDetailType(null);
                  openEditTypeSheet(target);
                }}
                className="rounded-xl"
              >
                <Edit3 data-icon="inline-start" className="size-4" />
                Ubah Kategori
              </Button>
            )}
          </>
        }
      >
        {detailType && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h4 className="text-base font-bold tracking-[-0.02em] text-foreground">
                {detailType.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                Acuan standar waktu kerja untuk perhitungan kapasitas dan lembur pegawai.
              </p>
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Hari Kerja / Minggu</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {detailType.work_days_per_week} hari/minggu
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Ambang Lembur Harian</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  &gt; {getDailyOvertimeThreshold(detailType)} jam/hari
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Jam Normal / Minggu</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {detailType.normal_weekly_hours} jam/minggu
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Pegawai Terkait</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {Number(detailType.employees_count || 0)} pegawai
                </dd>
              </div>
            </dl>
          </div>
        )}
      </FormSheet>

      {/* FormSheet: Create / Edit Employee */}
      <FormSheet
        open={employeeSheetOpen}
        onOpenChange={(open) => {
          if (!employeeSubmitting) setEmployeeSheetOpen(open);
        }}
        title={editingEmployee ? 'Ubah Pegawai' : 'Tambah Pegawai'}
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
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="cta"
              form="employee-form"
              disabled={employeeSubmitting}
              className="rounded-xl"
            >
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
        <form id="employee-form" onSubmit={handleEmployeeSubmit} className="flex flex-col gap-6">
          <AnimatePresence initial={false}>
            {employeeFormError && (
              <motion.div
                key="employee-form-error"
                role="alert"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-xs text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{employeeFormError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground">Identitas &amp; Penempatan</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-code" className="text-xs font-semibold">
                  Kode Pegawai <span className="text-danger">*</span>
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
                  className="h-10 rounded-xl bg-background tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-full-name" className="text-xs font-semibold">
                  Nama Lengkap <span className="text-danger">*</span>
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
                  className="h-10 rounded-xl bg-background"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-department" className="text-xs font-semibold">
                  Departemen <span className="text-danger">*</span>
                </Label>
                <Select
                  name="department_id"
                  value={employeeForm.department_id || undefined}
                  onValueChange={(val) =>
                    setEmployeeForm({ ...employeeForm, department_id: val })
                  }
                >
                  <SelectTrigger
                    id="emp-department"
                    className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                  >
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
                <Label htmlFor="emp-position" className="text-xs font-semibold">
                  Jabatan / Posisi <span className="text-danger">*</span>
                </Label>
                <Select
                  name="position_id"
                  value={employeeForm.position_id || undefined}
                  onValueChange={(val) => setEmployeeForm({ ...employeeForm, position_id: val })}
                >
                  <SelectTrigger
                    id="emp-position"
                    className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                  >
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
                <Label htmlFor="emp-type" className="text-xs font-semibold">
                  Jenis Kepegawaian <span className="text-danger">*</span>
                </Label>
                <Select
                  name="employment_type_id"
                  value={employeeForm.employment_type_id || undefined}
                  onValueChange={(val) =>
                    setEmployeeForm({ ...employeeForm, employment_type_id: val })
                  }
                >
                  <SelectTrigger
                    id="emp-type"
                    className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                  >
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
                <Label htmlFor="emp-join-date" className="text-xs font-semibold">
                  Tanggal Bergabung <span className="text-danger">*</span>
                </Label>
                <DatePicker
                  id="emp-join-date"
                  value={employeeForm.join_date}
                  onChange={(val) =>
                    setEmployeeForm({ ...employeeForm, join_date: val })
                  }
                  ariaLabel="Tanggal Bergabung"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-foreground">Akun &amp; Akses</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-email" className="text-xs font-semibold">
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
                  className="h-10 rounded-xl bg-background"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-password" className="text-xs font-semibold">
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
                  className="h-10 rounded-xl bg-background"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-role" className="text-xs font-semibold">
                  Peran Akses (RBAC) <span className="text-danger">*</span>
                </Label>
                <Select
                  name="role"
                  value={employeeForm.role}
                  onValueChange={(val) => setEmployeeForm({ ...employeeForm, role: val })}
                >
                  <SelectTrigger
                    id="emp-role"
                    className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                  >
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
                <Label htmlFor="emp-status" className="text-xs font-semibold">
                  Status Keaktifan <span className="text-danger">*</span>
                </Label>
                <Select
                  name="status"
                  value={employeeForm.status}
                  onValueChange={(val) => setEmployeeForm({ ...employeeForm, status: val })}
                >
                  <SelectTrigger
                    id="emp-status"
                    className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                  >
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
          </div>
        </form>
      </FormSheet>

      {/* ConfirmDialog: Delete Employee */}
      <ConfirmDialog
        open={Boolean(deletingEmployee)}
        onOpenChange={(open) => {
          if (!open && !deleteEmployeeLoading) setDeletingEmployee(null);
        }}
        title="Hapus Pegawai?"
        description={
          deletingEmployee ? (
            <>
              Data pegawai{' '}
              <span className="font-semibold text-foreground">{deletingEmployee.full_name}</span> (
              <span className="font-mono font-normal tabular-nums">
                {deletingEmployee.employee_code}
              </span>
              ) beserta akun login terkait akan dihapus secara permanen.
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
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="cta"
              form="employment-type-form"
              disabled={typeSubmitting}
              className="rounded-xl"
            >
              {typeSubmitting && <Spinner data-icon="inline-start" />}
              {typeSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <form id="employment-type-form" onSubmit={handleTypeSubmit} className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {typeFormError && (
              <motion.div
                key="type-form-error"
                role="alert"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-xs text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{typeFormError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type-name" className="text-xs font-semibold">
              Nama Jenis Kepegawaian <span className="text-danger">*</span>
            </Label>
            <Input
              id="type-name"
              name="name"
              type="text"
              required
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              placeholder="Misal: Tetap (PKWTT)"
              className="h-10 rounded-xl bg-background"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type-work-days" className="text-xs font-semibold">
                Hari Kerja / Minggu <span className="text-danger">*</span>
              </Label>
              <Select
                name="work_days_per_week"
                value={typeForm.work_days_per_week}
                onValueChange={(val) => setTypeForm({ ...typeForm, work_days_per_week: val })}
              >
                <SelectTrigger
                  id="type-work-days"
                  className="h-10 w-full rounded-xl bg-background data-[size=default]:h-10"
                >
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
              <Label htmlFor="type-weekly-hours" className="text-xs font-semibold">
                Jam Normal / Minggu <span className="text-danger">*</span>
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
                className="h-10 rounded-xl bg-background tabular-nums"
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
                <span className="mt-2.5 block rounded-xl border border-warning-border bg-warning-subtle px-3.5 py-2.5 text-xs text-warning tabular-nums">
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
