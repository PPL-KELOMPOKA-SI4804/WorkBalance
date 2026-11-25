import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatDate, formatDateTime } from '@/lib/format';
import { getInitials } from '@/lib/navigation';
import { extractApiError } from '@/services/api';
import { workplaceIssueService } from '@/services/workplaceIssueService';
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
const AUTO_DEPARTMENT_VALUE = '__auto__';

const ISSUE_STATUS_META = {
  open: {
    status: 'open',
    label: 'Menunggu',
    detailText: 'Menunggu peninjauan oleh manajer atau HR',
  },
  in_progress: {
    status: 'in_progress',
    label: 'Ditangani',
    detailText: 'Sedang dalam proses tindak lanjut tim terkait',
  },
  resolved: {
    status: 'resolved',
    label: 'Selesai',
    detailText: 'Permasalahan telah ditindaklanjuti dan selesai',
  },
};

const PRESET_CATEGORIES = [
  'Beban Kerja',
  'Jadwal & Lembur',
  'Fasilitas & Ergonomi',
  'Komunikasi Tim',
  'Kenyamanan & K3',
  'Lainnya',
];

function getIssueStatusMeta(status) {
  return ISSUE_STATUS_META[status] || ISSUE_STATUS_META.open;
}

function emptyIssueForm(defaultDepartmentId = '') {
  return {
    category: PRESET_CATEGORIES[0],
    department_id: defaultDepartmentId ? String(defaultDepartmentId) : '',
    description: '',
  };
}

function ReporterDetailIdentity({ reporter }) {
  const rep = reporter || {};

  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 border border-border">
        <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
          {getInitials(rep.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {rep.full_name || '-'}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-mono font-normal">{rep.employee_code || '-'}</span>
          {rep.position?.title ? ` · ${rep.position.title}` : ''}
        </span>
      </div>
    </div>
  );
}

function DepartmentDetailIdentity({ department }) {
  if (!department) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="font-mono text-xs font-normal">
        {department.code}
      </Badge>
      <span className="text-sm font-medium text-foreground">{department.name}</span>
    </div>
  );
}

export default function WorkplaceIssuesPage() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isEmployee = user?.role === 'employee';
  const canHandle = user?.role === 'admin' || user?.role === 'manager';
  const defaultDepartmentId = user?.employee?.department_id || '';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [issues, setIssues] = useState([]);
  const [apiCategories, setApiCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    resolution_rate: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Detail Sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit Issue Sheet
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [issueForm, setIssueForm] = useState(() => emptyIssueForm(defaultDepartmentId));
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Follow-up Sheet (Manager & Admin)
  const [followUpSheetOpen, setFollowUpSheetOpen] = useState(false);
  const [followUpIssue, setFollowUpIssue] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({
    status: 'in_progress',
    resolution_notes: '',
  });
  const [followUpError, setFollowUpError] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // Delete Dialog
  const [deletingIssue, setDeletingIssue] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await workplaceIssueService.getIssues({
        search: search.trim(),
        status: statusFilter,
        category: categoryFilter,
        department_id: departmentFilter,
      });

      setIssues(data?.issues || []);
      setApiCategories(data?.categories || []);
      setDepartments(data?.departments || []);
      setSummary(
        data?.summary || {
          total: 0,
          open: 0,
          in_progress: 0,
          resolved: 0,
          resolution_rate: 0,
        }
      );
    } catch (err) {
      setErrorMsg(
        extractApiError(err, 'Gagal memuat daftar laporan permasalahan kerja.').message
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, departmentFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useRefetchOnFocus(loadAllData);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...PRESET_CATEGORIES, ...apiCategories])),
    [apiCategories]
  );

  const formCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set([...PRESET_CATEGORIES, ...(issueForm.category ? [issueForm.category] : [])])
      ),
    [issueForm.category]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || categoryFilter || departmentFilter),
    [search, statusFilter, categoryFilter, departmentFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
  };

  // Detail Handler
  const openDetailSheet = useCallback(async (issue) => {
    setDetailIssue(issue);
    setDetailSheetOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await workplaceIssueService.getIssue(issue.id);
      setDetailIssue(fresh);
    } catch {
      // Keep list row snapshot if detail refresh fails
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Create / Edit Issue Handlers
  const openCreateSheet = useCallback(() => {
    setEditingIssue(null);
    const initialDept = defaultDepartmentId || departments[0]?.id || '';
    setIssueForm(emptyIssueForm(initialDept));
    setFormError('');
    setFormSheetOpen(true);
  }, [defaultDepartmentId, departments]);

  const openEditSheet = useCallback((issue) => {
    setEditingIssue(issue);
    setIssueForm({
      category: issue.category || PRESET_CATEGORIES[0],
      department_id: issue.department_id ? String(issue.department_id) : '',
      description: issue.description || '',
    });
    setFormError('');
    setFormSheetOpen(true);
  }, []);

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedDesc = issueForm.description.trim();
    if (!issueForm.category.trim()) {
      setFormError('Kategori permasalahan wajib dipilih.');
      return;
    }
    if (trimmedDesc.length < 10) {
      setFormError(
        'Deskripsi permasalahan minimal 10 karakter agar mudah ditindaklanjuti.'
      );
      return;
    }

    setFormSubmitting(true);
    const payload = {
      category: issueForm.category.trim(),
      description: trimmedDesc,
      ...(issueForm.department_id ? { department_id: Number(issueForm.department_id) } : {}),
    };

    try {
      if (editingIssue) {
        const res = await workplaceIssueService.updateIssue(editingIssue.id, payload);
        toast.success(res.message || 'Laporan permasalahan kerja berhasil diperbarui.');
      } else {
        const res = await workplaceIssueService.createIssue(payload);
        toast.success(res.message || 'Laporan permasalahan kerja berhasil dikirim.');
      }
      setFormSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFormError(
        extractApiError(err, 'Gagal menyimpan laporan permasalahan kerja.').message
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Follow-up Handlers (Manager & Admin)
  const openFollowUpSheet = useCallback((issue) => {
    setFollowUpIssue(issue);
    setFollowUpForm({
      status: issue.status || 'open',
      resolution_notes: issue.resolution_notes || '',
    });
    setFollowUpError('');
    setFollowUpSheetOpen(true);
  }, []);

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUpIssue) return;

    setFollowUpError('');
    const trimmedNotes = followUpForm.resolution_notes.trim();

    if (followUpForm.status === 'resolved' && trimmedNotes.length < 5) {
      setFollowUpError(
        'Mohon isi catatan penyelesaian minimal 5 karakter sebelum menandai laporan selesai.'
      );
      return;
    }

    setFollowUpSubmitting(true);
    try {
      const res = await workplaceIssueService.updateIssue(followUpIssue.id, {
        status: followUpForm.status,
        resolution_notes: trimmedNotes || null,
      });
      toast.success(res.message || 'Status tindak lanjut laporan berhasil diperbarui.');
      setFollowUpSheetOpen(false);
      await loadAllData();
    } catch (err) {
      setFollowUpError(
        extractApiError(err, 'Gagal memperbarui status penanganan laporan.').message
      );
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingIssue) return;
    setDeleteLoading(true);
    try {
      const res = await workplaceIssueService.deleteIssue(deletingIssue.id);
      toast.success(res.message || 'Laporan permasalahan kerja berhasil dihapus.');
      setDeletingIssue(null);
      await loadAllData();
    } catch (err) {
      toast.error(extractApiError(err, 'Laporan tidak dapat dihapus.').message);
      setDeletingIssue(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const resolutionRate = Number(summary.resolution_rate || 0);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'category',
        header: 'Kategori',
        size: 175,
        minSize: 120,
        maxSize: 300,
        cell: ({ row }) => {
          const category = row.original.category || '-';
          return (
            <span
              className="block truncate text-xs font-medium text-foreground"
              title={category}
            >
              {category}
            </span>
          );
        },
      },
      {
        accessorKey: 'description',
        header: 'Deskripsi Masalah',
        size: 275,
        minSize: 150,
        maxSize: 480,
        cell: ({ row }) => {
          const description = row.original.description;
          return (
            <span
              className="block truncate text-xs text-muted-foreground"
              title={description || undefined}
            >
              {description || '-'}
            </span>
          );
        },
      },
      {
        accessorFn: (row) => row.reporter?.full_name || '-',
        id: 'reporter',
        header: 'Pelapor',
        size: 200,
        minSize: 135,
        maxSize: 340,
        cell: ({ row }) => {
          const rep = row.original.reporter || {};
          const name = rep.full_name || '-';
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-7 shrink-0 border border-border">
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <span
                className="min-w-0 truncate text-xs font-medium text-foreground"
                title={name}
              >
                {name}
              </span>
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.department?.name || '-',
        id: 'department',
        header: 'Departemen',
        size: 175,
        minSize: 115,
        maxSize: 300,
        cell: ({ row }) => {
          const dept = row.original.department;
          if (!dept) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          const label = dept.code ? `${dept.code} · ${dept.name}` : dept.name || '-';
          return (
            <div className="flex min-w-0 items-center gap-1.5" title={label}>
              {dept.code && (
                <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
                  {dept.code}
                </Badge>
              )}
              <span className="min-w-0 truncate text-xs text-foreground">
                {dept.name || '-'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        minSize: 102,
        maxSize: 200,
        cell: ({ row }) => {
          const meta = getIssueStatusMeta(row.original.status);
          return (
            <div className="whitespace-nowrap">
              <StatusBadge status={meta.status} label={meta.label} />
            </div>
          );
        },
      },
      {
        accessorFn: (row) => row.resolution_notes || '',
        id: 'resolution_notes',
        header: 'Catatan Resolusi',
        size: 240,
        minSize: 140,
        maxSize: 440,
        cell: ({ row }) => {
          const notes = row.original.resolution_notes;
          return (
            <span
              className="block truncate text-xs text-muted-foreground"
              title={notes || undefined}
            >
              {notes || '-'}
            </span>
          );
        },
      },
      {
        accessorFn: (row) => row.created_at || '',
        id: 'created_at',
        header: 'Dilaporkan',
        size: 175,
        minSize: 135,
        maxSize: 240,
        cell: ({ row }) => {
          const formatted = formatDate(row.original.created_at);
          return (
            <span
              className="block truncate text-xs text-muted-foreground tabular-nums"
              title={formatted}
            >
              {formatted}
            </span>
          );
        },
      },
      {
        accessorFn: (row) => row.resolved_at || '',
        id: 'resolved_at',
        header: 'Selesai',
        size: 165,
        minSize: 130,
        maxSize: 240,
        cell: ({ row }) => {
          const formatted = row.original.resolved_at
            ? formatDate(row.original.resolved_at)
            : '-';
          return (
            <span
              className="block truncate text-xs text-muted-foreground tabular-nums"
              title={formatted}
            >
              {formatted}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        enableResizing: false,
        size: 64,
        minSize: 56,
        maxSize: 72,
        cell: ({ row }) => {
          const issue = row.original;
          const isOpen = issue.status === 'open';

          return (
            <RowActionsMenu
              ariaLabel="Aksi laporan masalah"
              items={[
                {
                  key: 'follow-up',
                  label: 'Tindak Lanjut',
                  icon: Wrench,
                  hidden: !canHandle,
                  onSelect: () => openFollowUpSheet(issue),
                },
                {
                  key: 'edit',
                  label: 'Ubah',
                  icon: Edit3,
                  hidden: !(isEmployee && isOpen),
                  onSelect: () => openEditSheet(issue),
                },
                {
                  key: 'delete',
                  label: 'Hapus',
                  icon: Trash2,
                  variant: 'destructive',
                  hidden: !isOpen,
                  onSelect: () => setDeletingIssue(issue),
                },
              ]}
            />
          );
        },
      },
    ],
    [canHandle, isEmployee, openEditSheet, openFollowUpSheet]
  );

  const detailStatusMeta = detailIssue ? getIssueStatusMeta(detailIssue.status) : null;

  return (
    <AppShell
      title="Laporan Masalah & K3"
      breadcrumb={isEmployee ? 'Ruang Kerja' : 'Kesejahteraan'}
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
              label={isEmployee ? 'Laporan Saya' : 'Laporan Masuk'}
              value={summary.total ?? 0}
              unit="laporan"
              hint={isEmployee ? 'Aspirasi & kendala pribadi' : 'Seluruh departemen'}
            />

            <KpiStatCard
              label="Menunggu Penanganan"
              value={summary.open ?? 0}
              unit="laporan"
              status="open"
              statusLabel="Perlu peninjauan"
            />

            <KpiStatCard
              label="Sedang Ditangani"
              value={summary.in_progress ?? 0}
              unit="laporan"
              status="in_progress"
              statusLabel="Dalam tindak lanjut"
            />

            <KpiStatCard
              label="Selesai Ditangani"
              value={summary.resolved ?? 0}
              unit="selesai"
              status="resolved"
              statusLabel={`Resolusi ${resolutionRate.toFixed(1)}%`}
            />
          </section>
        )}

        {/* Row 2: Issues DataTable */}
        <DataTable
          title={isEmployee ? 'Laporan Saya' : 'Laporan Masuk'}
          countLabel="laporan"
          columns={columns}
          data={issues}
          loading={loading}
          error={errorMsg}
          onRetry={loadAllData}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari kategori, deskripsi, atau pelapor..."
          pageSize={10}
          onRowClick={(row) => openDetailSheet(row)}
          emptyTitle={
            hasActiveFilters
              ? 'Tidak ada laporan sesuai filter'
              : 'Belum ada laporan permasalahan'
          }
          emptyDescription={
            hasActiveFilters
              ? 'Tidak ditemukan laporan yang sesuai dengan kata kunci atau filter yang dipilih.'
              : isEmployee
                ? 'Anda belum mengirimkan laporan permasalahan tempat kerja. Gunakan tombol di bawah jika ada kendala yang perlu ditindaklanjuti.'
                : 'Belum ada laporan permasalahan kerja yang tercatat pada sistem.'
          }
          emptyAction={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={resetFilters}>
                  <RotateCcw className="size-4" data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              <Button variant="cta" size="sm" className="rounded-xl" onClick={openCreateSheet}>
                <Plus className="size-4" data-icon="inline-start" />
                Laporkan Masalah
              </Button>
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
                  id="wi-filter-status"
                  size="sm"
                  aria-label="Filter status penanganan"
                  className="h-9 w-36 rounded-xl bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Status</SelectItem>
                    <SelectItem value="open">Menunggu</SelectItem>
                    <SelectItem value="in_progress">Ditangani</SelectItem>
                    <SelectItem value="resolved">Selesai</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                name="filter_category"
                value={categoryFilter || ALL_VALUE}
                onValueChange={(val) =>
                  setCategoryFilter(val === ALL_VALUE ? '' : val)
                }
              >
                <SelectTrigger
                  id="wi-filter-category"
                  size="sm"
                  aria-label="Filter kategori permasalahan"
                  className="h-9 w-44 rounded-xl bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Kategori</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
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
                  id="wi-filter-department"
                  size="sm"
                  aria-label="Filter departemen"
                  className="h-9 w-44 rounded-xl bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs font-normal text-muted-foreground">
                            {dept.code}
                          </span>
                          <span>{dept.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <AnimatePresence initial={false}>
                {hasActiveFilters && (
                  <motion.div
                    key="wi-reset-filters"
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
            <Button variant="cta" size="sm" className="rounded-xl" onClick={openCreateSheet}>
              <Plus className="size-4" data-icon="inline-start" />
              Laporkan Masalah
            </Button>
          }
        />
      </div>

      {/* Sheet 1: Detail Laporan */}
      <FormSheet
        open={detailSheetOpen && Boolean(detailIssue)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Laporan"
        description={
          detailIssue
            ? `ID #${detailIssue.id} · Dikirim ${formatDateTime(detailIssue.created_at)}`
            : undefined
        }
        size="lg"
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
            {canHandle && detailIssue && (
              <Button
                variant="cta"
                className="rounded-xl"
                onClick={() => {
                  const target = detailIssue;
                  setDetailSheetOpen(false);
                  openFollowUpSheet(target);
                }}
              >
                <Wrench className="size-4" data-icon="inline-start" />
                Tindak Lanjut
              </Button>
            )}
            {isEmployee && detailIssue?.status === 'open' && (
              <Button
                variant="cta"
                className="rounded-xl"
                onClick={() => {
                  const target = detailIssue;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 className="size-4" data-icon="inline-start" />
                Ubah Laporan
              </Button>
            )}
          </>
        }
      >
        {detailIssue && (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs text-muted-foreground">Kategori</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {detailIssue.category}
                </dd>
              </div>

              <div className="flex flex-col gap-1.5">
                <dt className="text-xs text-muted-foreground">Status Penanganan</dt>
                <dd>
                  {detailStatusMeta && (
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge
                        status={detailStatusMeta.status}
                        label={detailStatusMeta.label}
                      />
                      <span className="text-xs text-muted-foreground">
                        {detailStatusMeta.detailText}
                      </span>
                    </div>
                  )}
                </dd>
              </div>

              <div className="flex flex-col gap-2">
                <dt className="text-xs text-muted-foreground">Pelapor</dt>
                <dd>
                  <ReporterDetailIdentity reporter={detailIssue.reporter} />
                </dd>
              </div>

              <div className="flex flex-col gap-1.5">
                <dt className="text-xs text-muted-foreground">Departemen Terkait</dt>
                <dd>
                  <DepartmentDetailIdentity department={detailIssue.department} />
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Waktu Pelaporan</dt>
                <dd className="text-sm font-medium text-foreground tabular-nums">
                  {formatDateTime(detailIssue.created_at)}
                </dd>
              </div>

              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Waktu Penyelesaian</dt>
                <dd className="text-sm font-medium text-foreground tabular-nums">
                  {detailIssue.resolved_at
                    ? formatDateTime(detailIssue.resolved_at)
                    : 'Belum selesai'}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Deskripsi Permasalahan
              </span>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {detailIssue.description}
              </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Catatan &amp; Tindak Lanjut Manajer / HR
              </span>
              <p
                className={
                  detailIssue.resolution_notes
                    ? 'text-sm leading-relaxed whitespace-pre-wrap text-foreground'
                    : 'text-sm leading-relaxed text-muted-foreground'
                }
              >
                {detailIssue.resolution_notes ||
                  'Belum ada catatan tindak lanjut dari manajer atau HR.'}
              </p>
            </div>
          </div>
        )}
      </FormSheet>

      {/* Sheet 2: Buat / Edit Laporan */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        title={editingIssue ? 'Ubah Laporan Masalah' : 'Laporkan Masalah Baru'}
        description="Sampaikan kendala secara jelas dan konstruktif untuk ditindaklanjuti."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFormSheetOpen(false)}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="cta"
              form="workplace-issue-form"
              className="rounded-xl"
              disabled={formSubmitting}
            >
              {formSubmitting && <Spinner data-icon="inline-start" />}
              {formSubmitting
                ? 'Menyimpan...'
                : editingIssue
                  ? 'Simpan Perubahan'
                  : 'Kirim Laporan'}
            </Button>
          </>
        }
      >
        <form
          id="workplace-issue-form"
          onSubmit={handleIssueSubmit}
          className="flex flex-col gap-5"
        >
          <AnimatePresence initial={false}>
            {formError && (
              <motion.div
                key="wi-form-error"
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
            <Label htmlFor="wi-category" className="text-xs font-semibold">
              Kategori Permasalahan <span className="text-danger">*</span>
            </Label>
            <Select
              name="category"
              value={issueForm.category}
              onValueChange={(val) =>
                setIssueForm((prev) => ({ ...prev, category: val }))
              }
            >
              <SelectTrigger id="wi-category" className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Pilih Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {formCategoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-department" className="text-xs font-semibold">
              Departemen Terkait
            </Label>
            <Select
              name="department_id"
              value={issueForm.department_id || AUTO_DEPARTMENT_VALUE}
              onValueChange={(val) =>
                setIssueForm((prev) => ({
                  ...prev,
                  department_id: val === AUTO_DEPARTMENT_VALUE ? '' : val,
                }))
              }
            >
              <SelectTrigger id="wi-department" className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Otomatis sesuai departemen saya" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={AUTO_DEPARTMENT_VALUE}>
                    Otomatis sesuai departemen saya
                  </SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {dept.code}
                        </span>
                        <span>{dept.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-description" className="text-xs font-semibold">
              Deskripsi Permasalahan <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="wi-description"
              name="description"
              rows={5}
              required
              value={issueForm.description}
              onChange={(e) =>
                setIssueForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Jelaskan situasi, dampak terhadap kenyamanan atau beban kerja, serta konteks lokasi/waktu bila relevan..."
              className="rounded-xl bg-background"
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              Minimal 10 karakter ({issueForm.description.trim().length} karakter tertulis).
            </p>
          </div>
        </form>
      </FormSheet>

      {/* Sheet 3: Tindak Lanjut Laporan (Manager & Admin) */}
      {canHandle && (
        <FormSheet
          open={followUpSheetOpen && Boolean(followUpIssue)}
          onOpenChange={setFollowUpSheetOpen}
          title="Tindak Lanjut Laporan"
          description={
            followUpIssue
              ? `Pelapor: ${followUpIssue.reporter?.full_name || '-'} · Kategori: ${followUpIssue.category}`
              : undefined
          }
          size="md"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFollowUpSheetOpen(false)}
                disabled={followUpSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="cta"
                form="workplace-followup-form"
                className="rounded-xl"
                disabled={followUpSubmitting}
              >
                {followUpSubmitting && <Spinner data-icon="inline-start" />}
                {followUpSubmitting ? 'Menyimpan...' : 'Simpan Tindak Lanjut'}
              </Button>
            </>
          }
        >
          {followUpIssue && (
            <form
              id="workplace-followup-form"
              onSubmit={handleFollowUpSubmit}
              className="flex flex-col gap-5"
            >
              <AnimatePresence initial={false}>
                {followUpError && (
                  <motion.div
                    key="wi-followup-error"
                    role="alert"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                    className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-xs text-danger"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{followUpError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Ringkasan Laporan
                </span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {followUpIssue.description}
                </p>
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-followup-status" className="text-xs font-semibold">
                  Status Penanganan <span className="text-danger">*</span>
                </Label>
                <Select
                  name="status"
                  value={followUpForm.status}
                  onValueChange={(val) =>
                    setFollowUpForm((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger id="wi-followup-status" className="h-10 w-full rounded-xl bg-background">
                    <SelectValue placeholder="Pilih Status Penanganan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="open">Menunggu (Open)</SelectItem>
                      <SelectItem value="in_progress">
                        Sedang Ditangani (In Progress)
                      </SelectItem>
                      <SelectItem value="resolved">
                        Selesai Ditangani (Resolved)
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-followup-notes" className="text-xs font-semibold">
                  Catatan Tindak Lanjut / Resolusi{' '}
                  {followUpForm.status === 'resolved' && (
                    <span className="text-danger">*</span>
                  )}
                </Label>
                <Textarea
                  id="wi-followup-notes"
                  name="resolution_notes"
                  rows={5}
                  value={followUpForm.resolution_notes}
                  onChange={(e) =>
                    setFollowUpForm((prev) => ({
                      ...prev,
                      resolution_notes: e.target.value,
                    }))
                  }
                  placeholder="Tuliskan langkah penanganan, penjadwalan ulang, atau solusi yang telah diterapkan..."
                  className="rounded-xl bg-background"
                />
                {followUpForm.status === 'resolved' && (
                  <p className="text-xs text-muted-foreground">
                    Wajib diisi minimal 5 karakter sebelum menandai laporan selesai.
                  </p>
                )}
              </div>
            </form>
          )}
        </FormSheet>
      )}

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deletingIssue)}
        onOpenChange={(open) => {
          if (!open) setDeletingIssue(null);
        }}
        title="Hapus Laporan Permasalahan?"
        description={
          deletingIssue ? (
            <>
              Anda akan menghapus laporan kategori{' '}
              <span className="font-semibold text-foreground">
                {deletingIssue.category}
              </span>{' '}
              yang masih berstatus <span className="font-semibold">Menunggu</span>.
              Tindakan ini tidak dapat dibatalkan.
            </>
          ) : undefined
        }
        confirmLabel={deleteLoading ? 'Menghapus...' : 'Ya, Hapus Laporan'}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
