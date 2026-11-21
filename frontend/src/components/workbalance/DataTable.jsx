import { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  flexRender,
  sortFns,
  stockFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function DataTable({
  columns,
  data = [],
  title,
  countLabel,
  loading = false,
  error = '',
  onRetry,
  searchable = true,
  searchPlaceholder = 'Cari...',
  searchValue,
  onSearchChange,
  filterSlot,
  actionsSlot,
  pageSize = 10,
  emptyTitle = 'Belum ada data',
  emptyDescription = 'Data akan muncul di sini setelah tersedia atau sesuai filter yang dipilih.',
  emptyAction,
  onRowClick,
  className,
}) {
  const searchInputId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [sorting, setSorting] = useState([]);
  const [internalSearch, setInternalSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const isControlledSearch = typeof onSearchChange === 'function';
  const activeSearch = isControlledSearch ? searchValue ?? '' : internalSearch;

  const handleSearch = (val) => {
    if (isControlledSearch) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
    }
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const [features] = useState(() => ({
    ...stockFeatures,
    filterFns,
    sortFns,
    filteredRowModel: createFilteredRowModel(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
  }));

  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const table = useTable(
    {
      features,
      data: safeData,
      columns,
      state: {
        sorting,
        globalFilter: isControlledSearch ? '' : activeSearch,
        pagination,
      },
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      onGlobalFilterChange: (val) => {
        if (!isControlledSearch) setInternalSearch(String(val ?? ''));
      },
    },
    (state) => state
  );

  const rows = table.getRowModel().rows;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize: currentPageSize } = table.state.pagination;
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * currentPageSize + 1;
  const rangeEnd = Math.min(totalFiltered, (pageIndex + 1) * currentPageSize);

  const isInitialLoading = loading && safeData.length === 0;
  const isRefetching = loading && safeData.length > 0;

  return (
    <div
      data-slot="data-table"
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card',
        className
      )}
    >
      {/* Toolbar */}
      {(title || searchable || filterSlot || actionsSlot) && (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-baseline gap-2">
              {title && (
                <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  {title}
                </h3>
              )}
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {totalFiltered}
                {countLabel ? ` ${countLabel}` : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {searchable && !filterSlot && (
                <div className="relative w-full sm:w-72">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={searchInputId}
                    name="table_search"
                    type="text"
                    value={activeSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-8 rounded-lg bg-background pl-8 pr-7 text-xs"
                  />
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={() => handleSearch('')}
                      aria-label="Hapus pencarian"
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              {actionsSlot}
            </div>
          </div>

          {filterSlot && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {searchable && (
                <div className="relative w-full sm:w-64 lg:w-72">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={searchInputId}
                    name="table_search"
                    type="text"
                    value={activeSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-8 rounded-lg bg-background pl-8 pr-7 text-xs"
                  />
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={() => handleSearch('')}
                      aria-label="Hapus pencarian"
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {filterSlot}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-destructive refetch loading progress indicator */}
      {isRefetching && (
        <div
          aria-live="polite"
          aria-label="Memperbarui data tabel"
          className="relative h-0.5 w-full overflow-hidden bg-muted"
        >
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
            initial={{ x: '-100%' }}
            animate={prefersReducedMotion ? { x: '0%', width: '100%' } : { x: '320%' }}
            transition={
              prefersReducedMotion
                ? { duration: 0.15 }
                : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        </div>
      )}

      {/* Content states: Error | Initial Skeleton | Empty | Table */}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Gagal memuat data
            </p>
            <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              Coba Lagi
            </Button>
          )}
        </div>
      ) : isInitialLoading ? (
        <div className="flex flex-col gap-2.5 p-4">
          {Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <Skeleton className="h-8 w-1/4 rounded-lg" />
              <Skeleton className="h-8 w-1/3 rounded-lg" />
              <Skeleton className="h-8 w-1/5 rounded-lg" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="size-5" />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
          {emptyAction && <EmptyContent>{emptyAction}</EmptyContent>}
        </Empty>
      ) : (
        <div
          className={cn(
            'overflow-x-auto transition-opacity duration-150',
            isRefetching && 'pointer-events-none opacity-60'
          )}
        >
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="h-9 px-4 text-xs font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {sortDir === 'asc' ? (
                              <ArrowUp className="size-3.5 text-primary" />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="size-3.5 text-primary" />
                            ) : (
                              <ArrowUpDown className="size-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-3 text-sm whitespace-normal"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      {!isInitialLoading && !error && totalFiltered > currentPageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-medium text-foreground">
              {rangeStart}–{rangeEnd}
            </span>{' '}
            dari <span className="font-medium text-foreground">{totalFiltered}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft data-icon="inline-start" />
              Sebelumnya
            </Button>
            <span className="px-2 text-xs font-medium text-foreground tabular-nums">
              {pageIndex + 1} / {Math.max(1, pageCount)}
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Berikutnya
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
