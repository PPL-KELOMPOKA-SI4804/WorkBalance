import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Lock,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function emptyIssueForm(defaultDepartmentId = '') {
  return {
    category: PRESET_CATEGORIES[0],
    department_id: defaultDepartmentId ? String(defaultDepartmentId) : '',
    description: '',
  };
}

export default function WorkplaceIssuesPage() {
  const { user } = useAuth();
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
  const [statusFilter, setStatusFilter] = useState('all');
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
        status: statusFilter === 'all' ? '' : statusFilter,
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
    () =>
      Boolean(
        search.trim() || statusFilter !== 'all' || categoryFilter || departmentFilter
      ),
    [search, statusFilter, categoryFilter, departmentFilter]
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('');
    setDepartmentFilter('');
  };

  // --- Detail Handler ---
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

  // --- Create / Edit Issue Handlers ---
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

  // --- Follow-up Handlers (Manager & Admin) ---
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

  // --- Delete Handler ---
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

  const columns = useMemo(() => {
    const cols = [
      {
        accessorFn: (row) => `${row.category || ''} ${row.description || ''}`,
        id: 'issue',
        header: 'Kategori & Deskripsi',
        cell: ({ row }) => {
          const issue = row.original;
          return (
            <div className="flex max-w-[240px] flex-col gap-1 whitespace-normal">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {issue.category}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatDateTime(issue.created_at)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-snug text-foreground">
                {issue.description}
              </p>
            </div>
          );
        },
      },
    ];

    if (canHandle) {
      cols.push({
        accessorFn: (row) => row.reporter?.full_name || '-',
        id: 'reporter',
        header: 'Pelapor',
        cell: ({ row }) => {
          const rep = row.original.reporter || {};
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Avatar className="size-7 border border-border">
                <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
                  {getInitials(rep.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
                  {rep.full_name || '-'}
                </span>
                <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{rep.employee_code || '-'}</span>
                  {rep.position?.title ? ` · ${rep.position.title}` : ''}
                </span>
              </div>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        accessorFn: (row) => row.department?.name || '-',
        id: 'department',
        header: 'Departemen',
        cell: ({ row }) => {
          const dept = row.original.department;
          if (!dept) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
              <Badge variant="outline" className="font-mono text-[11px]">
                {dept.code}
              </Badge>
              <span className="max-w-[130px] truncate text-[11px] text-muted-foreground">
                {dept.name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const issue = row.original;
          const meta = getIssueStatusMeta(issue.status);
          return (
            <div className="flex flex-col items-start gap-1 whitespace-nowrap">
              <StatusBadge status={meta.status} label={meta.label} />
              {issue.resolved_at && (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatDateTime(issue.resolved_at)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'resolution_notes',
        header: 'Catatan Tindak Lanjut',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.resolution_notes ? (
            <p className="max-w-[200px] line-clamp-2 text-xs leading-snug text-muted-foreground whitespace-normal">
              {row.original.resolution_notes}
            </p>
          ) : (
            <span className="text-xs italic text-muted-foreground/70">
              Belum ada catatan
            </span>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const issue = row.original;
          const isOpen = issue.status === 'open';

          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Lihat detail laporan"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDetailSheet(issue);
                    }}
                  >
                    <Eye className="size-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lihat detail laporan</TooltipContent>
              </Tooltip>

              {canHandle && (
                <Button
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFollowUpSheet(issue);
                  }}
                >
                  <Wrench data-icon="inline-start" />
                  Tindak Lanjut
                </Button>
              )}

              {isEmployee && isOpen && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditSheet(issue);
                  }}
                >
                  <Edit3 data-icon="inline-start" />
                  Edit
                </Button>
              )}

              {isOpen ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus laporan"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingIssue(issue);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hapus laporan menunggu</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/60"
                      aria-label="Terkunci untuk jejak audit"
                    >
                      <Lock className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Laporan sedang ditangani atau selesai terkunci untuk menjaga jejak audit
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      }
    );

    return cols;
  }, [canHandle, isEmployee, openDetailSheet, openEditSheet, openFollowUpSheet]);

  const detailStatusMeta = detailIssue ? getIssueStatusMeta(detailIssue.status) : null;

  return (
    <AppShell
      title="Pelaporan Permasalahan Kerja"
      breadcrumb={
        isEmployee
          ? 'Kesejahteraan & Pelatihan / Laporan & Pemantauan Kendala Kerja'
          : 'Kesejahteraan & Kompetensi / Penanganan & Resolusi Kendala Kerja'
      }
      actions={
        <Button size="sm" onClick={openCreateSheet}>
          <Plus data-icon="inline-start" />
          Laporkan Masalah
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Row 1: 4 KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              label={isEmployee ? 'Total Laporan Saya' : 'Total Laporan Masuk'}
              value={summary.total ?? 0}
              unit="laporan"
              icon={MessageSquareWarning}
              hint={isEmployee ? 'Aspirasi & kendala pribadi' : 'Seluruh departemen'}
            />

            <KpiStatCard
              label="Menunggu Penanganan"
              value={summary.open ?? 0}
              unit="laporan"
              icon={Clock}
              status="open"
              statusLabel="Menunggu"
              hint="Perlu peninjauan"
            />

            <KpiStatCard
              label="Sedang Ditangani"
              value={summary.in_progress ?? 0}
              unit="laporan"
              icon={Wrench}
              status="in_progress"
              statusLabel="Ditangani"
              hint="Dalam proses tindak lanjut"
            />

            <KpiStatCard
              label="Selesai Ditangani"
              value={summary.resolved ?? 0}
              unit="selesai"
              icon={CheckCircle2}
              progress={resolutionRate}
              status="resolved"
              statusLabel={`Resolusi ${resolutionRate.toFixed(1)}%`}
            />
          </section>
        )}

        {/* Non-punitive / Governance Callout */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">
              Saluran Suara Pekerja &amp; Jejak Audit:
            </span>{' '}
            {isEmployee
              ? 'Sampaikan kendala beban kerja, jadwal, fasilitas, atau komunikasi tim secara terbuka dan konstruktif. Laporan berstatus Menunggu masih dapat Anda ubah atau batalkan; laporan yang sudah diproses terkunci sebagai jejak audit penanganan.'
              : 'Tindak lanjuti setiap kendala kerja secara konstruktif dan transparan. Rasio penyelesaian laporan berkontribusi langsung pada sub-indikator Dimensi 5 (Suara Pekerja) dalam Decent Work Score.'}
          </p>
        </div>

        {/* Row 2: Issues DataTable */}
        <DataTable
          title={isEmployee ? 'Daftar Laporan Saya' : 'Daftar Laporan Permasalahan Kerja'}
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
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw data-icon="inline-start" />
                  Reset Filter
                </Button>
              )}
              <Button size="sm" onClick={openCreateSheet}>
                <Plus data-icon="inline-start" />
                Laporkan Masalah
              </Button>
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
                <ToggleGroupItem value="open" className="text-xs">
                  Menunggu
                </ToggleGroupItem>
                <ToggleGroupItem value="in_progress" className="text-xs">
                  Ditangani
                </ToggleGroupItem>
                <ToggleGroupItem value="resolved" className="text-xs">
                  Selesai
                </ToggleGroupItem>
              </ToggleGroup>

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
                  className="w-44 bg-background text-xs"
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
                  className="w-44 bg-background text-xs"
                >
                  <SelectValue placeholder="Semua Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VALUE}>Semua Departemen</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.code} — {dept.name}
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
              aria-label="Muat ulang daftar"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          }
        />
      </div>

      {/* Sheet 1: Detail Laporan */}
      <FormSheet
        open={detailSheetOpen && Boolean(detailIssue)}
        onOpenChange={setDetailSheetOpen}
        title="Detail Laporan Permasalahan Kerja"
        description={
          detailIssue
            ? `ID Laporan #${detailIssue.id} · Dikirim ${formatDateTime(detailIssue.created_at)}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Tutup
            </Button>
            {canHandle && detailIssue && (
              <Button
                onClick={() => {
                  const target = detailIssue;
                  setDetailSheetOpen(false);
                  openFollowUpSheet(target);
                }}
              >
                <Wrench data-icon="inline-start" />
                Tindak Lanjut
              </Button>
            )}
            {isEmployee && detailIssue?.status === 'open' && (
              <Button
                onClick={() => {
                  const target = detailIssue;
                  setDetailSheetOpen(false);
                  openEditSheet(target);
                }}
              >
                <Edit3 data-icon="inline-start" />
                Edit Laporan
              </Button>
            )}
          </>
        }
      >
        {detailIssue && (
          <div className="flex flex-col gap-5">
            {detailLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                <span>Menyegarkan detail laporan...</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3.5">
                <span className="text-xs text-muted-foreground">Kategori</span>
                <span className="text-sm font-semibold text-foreground">
                  {detailIssue.category}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3.5">
                <span className="text-xs text-muted-foreground">Status Penanganan</span>
                {detailStatusMeta && (
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge
                      status={detailStatusMeta.status}
                      label={detailStatusMeta.label}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {detailStatusMeta.detailText}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
                <span className="text-xs text-muted-foreground">Pelapor</span>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8 border border-border">
                    <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                      {getInitials(detailIssue.reporter?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {detailIssue.reporter?.full_name || '-'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">
                        {detailIssue.reporter?.employee_code || '-'}
                      </span>
                      {detailIssue.reporter?.position?.title
                        ? ` · ${detailIssue.reporter.position.title}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3.5">
                <span className="text-xs text-muted-foreground">Departemen Terkait</span>
                <span className="text-sm font-medium text-foreground">
                  {detailIssue.department
                    ? `${detailIssue.department.code} — ${detailIssue.department.name}`
                    : '-'}
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Deskripsi Permasalahan
              </span>
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {detailIssue.description}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Catatan &amp; Tindak Lanjut Manajer / HR
              </span>
              <div
                className={
                  detailIssue.resolution_notes
                    ? 'rounded-lg border border-border bg-card p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground'
                    : 'rounded-lg border border-border bg-muted/20 p-3.5 text-sm italic text-muted-foreground'
                }
              >
                {detailIssue.resolution_notes ||
                  'Belum ada catatan tindak lanjut dari manajer atau HR.'}
              </div>
              {detailIssue.resolved_at && (
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  Diselesaikan pada: {formatDateTime(detailIssue.resolved_at)}
                </p>
              )}
            </div>
          </div>
        )}
      </FormSheet>

      {/* Sheet 2: Buat / Edit Laporan */}
      <FormSheet
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        title={
          editingIssue ? 'Edit Laporan Permasalahan Kerja' : 'Buat Laporan Permasalahan Baru'
        }
        description="Sampaikan kendala secara jelas dan konstruktif untuk ditindaklanjuti."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormSheetOpen(false)}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="workplace-issue-form"
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
          className="flex flex-col gap-4"
        >
          {formError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-category">
              Kategori Permasalahan <span className="text-destructive">*</span>
            </Label>
            <Select
              name="category"
              value={issueForm.category}
              onValueChange={(val) =>
                setIssueForm((prev) => ({ ...prev, category: val }))
              }
            >
              <SelectTrigger id="wi-category" className="w-full bg-background">
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
            <Label htmlFor="wi-department">Departemen Terkait</Label>
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
              <SelectTrigger id="wi-department" className="w-full bg-background">
                <SelectValue placeholder="Otomatis sesuai departemen saya" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={AUTO_DEPARTMENT_VALUE}>
                    Otomatis sesuai departemen saya
                  </SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.code} — {dept.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-description">
              Deskripsi Permasalahan <span className="text-destructive">*</span>
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
              className="bg-background"
            />
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
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
          title="Tindak Lanjut Laporan Permasalahan"
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
                onClick={() => setFollowUpSheetOpen(false)}
                disabled={followUpSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="workplace-followup-form"
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
              className="flex flex-col gap-4"
            >
              {followUpError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{followUpError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Ringkasan Laporan</span>
                <p className="whitespace-pre-wrap">{followUpIssue.description}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wi-followup-status">
                  Status Penanganan <span className="text-destructive">*</span>
                </Label>
                <Select
                  name="status"
                  value={followUpForm.status}
                  onValueChange={(val) =>
                    setFollowUpForm((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger id="wi-followup-status" className="w-full bg-background">
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
                <Label htmlFor="wi-followup-notes">
                  Catatan Tindak Lanjut / Resolusi{' '}
                  {followUpForm.status === 'resolved' && (
                    <span className="text-destructive">*</span>
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
                  className="bg-background"
                />
                {followUpForm.status === 'resolved' && (
                  <p className="text-[11px] text-muted-foreground">
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
