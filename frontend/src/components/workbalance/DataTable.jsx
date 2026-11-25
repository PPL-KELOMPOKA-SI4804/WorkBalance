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

function buildPaginationRange(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages = new Set([0, totalPages - 1, currentPage]);
  if (currentPage > 0) pages.add(currentPage - 1);
  if (currentPage < totalPages - 1) pages.add(currentPage + 1);
  if (currentPage <= 1) pages.add(2);
  if (currentPage >= totalPages - 2) pages.add(totalPages - 3);

  const sorted = Array.from(pages)
    .filter((p) => p >= 0 && p < totalPages)
    .sort((a, b) => a - b);

  const items = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      items.push(`ellipsis-${i}`);
    }
    items.push(sorted[i]);
  }
  return items;
}

export function DataTable({
  columns,
  data = [],
  title,
  description,
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
  const pageCount = Math.max(1, table.getPageCount());
  const { pageIndex, pageSize: currentPageSize } = table.state.pagination;
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * currentPageSize + 1;
  const rangeEnd = Math.min(totalFiltered, (pageIndex + 1) * currentPageSize);

  const isInitialLoading = loading && safeData.length === 0;
  const isRefetching = loading && safeData.length > 0;
  const pageNumbers = useMemo(
    () => buildPaginationRange(pageIndex, pageCount),
    [pageIndex, pageCount]
  );

  const hasToolbarRow = searchable || Boolean(filterSlot);

  return (
    <div
      data-slot="data-table"
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card',
        className
      )}
    >
      {/* HRDashboard Card Header: Title + Count on left, Primary CTA on top-right */}
      {(title || actionsSlot) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2.5">
              {title && (
                <h3 className="text-base font-bold tracking-[-0.02em] text-foreground">
                  {title}
                </h3>
              )}
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {totalFiltered}
                {countLabel ? ` ${countLabel}` : ''}
              </span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>

          {actionsSlot && (
            <div className="flex flex-wrap items-center gap-2">{actionsSlot}</div>
          )}
        </div>
      )}

      {/* Single-Row Search & Inline Filter Bar (HRDashboard 19. Employee rhythm) */}
      {hasToolbarRow && (
        <div
          className={cn(
            'flex flex-col gap-2.5 px-5 pb-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between',
            !title && !actionsSlot && 'pt-5'
          )}
        >
          {searchable && (
            <div className="relative w-full lg:max-w-sm lg:flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchInputId}
                name="table_search"
                type="text"
                value={activeSearch}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 rounded-xl bg-background pl-9 pr-8 text-xs sm:text-sm"
              />
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  aria-label="Hapus pencarian"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {filterSlot && (
            <div className="flex flex-wrap items-center gap-2">{filterSlot}</div>
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
            animate={
              prefersReducedMotion ? { x: '0%', width: '100%' } : { x: '320%' }
            }
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
          <div className="flex size-10 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <AlertCircle className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              Gagal memuat data
            </p>
            <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Coba Lagi
            </Button>
          )}
        </div>
      ) : isInitialLoading ? (
        <div className="flex flex-col gap-2.5 px-5 pb-6 sm:px-6">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 py-1">
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
            'overflow-x-auto px-5 pb-2 transition-opacity duration-150 sm:px-6',
            isRefetching && 'pointer-events-none opacity-60'
          )}
        >
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-muted/75 hover:bg-muted/75"
                >
                  {headerGroup.headers.map((header, idx) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    const colMetaClass = header.column.columnDef.meta?.className;
                    const isFirst = idx === 0;
                    const isLast = idx === headerGroup.headers.length - 1;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'h-11 px-4 text-xs font-semibold text-muted-foreground',
                          isFirst && 'rounded-l-xl',
                          isLast && 'rounded-r-xl',
                          colMetaClass
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 text-left font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-border/75 transition-colors last:border-b-0 hover:bg-muted/40',
                    onRowClick &&
                      'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-4 py-3.5 text-sm whitespace-normal',
                        cell.column.columnDef.meta?.className
                      )}
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

      {/* HRDashboard Numbered Pagination Footer (< 1 2 3 ... N >) */}
      {!isInitialLoading && !error && totalFiltered > currentPageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 px-5 py-3.5 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Halaman sebelumnya"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="size-8 rounded-lg"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {pageNumbers.map((item) => {
              if (typeof item === 'string') {
                return (
                  <span
                    key={item}
                    className="flex size-8 items-center justify-center text-xs text-muted-foreground"
                  >
                    ...
                  </span>
                );
              }
              const isCurrent = item === pageIndex;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => table.setPageIndex(item)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg text-xs tabular-nums transition-colors',
                    isCurrent
                      ? 'border border-border bg-muted font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {item + 1}
                </button>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Halaman berikutnya"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="size-8 rounded-lg"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <span className="tabular-nums">
            Menampilkan{' '}
            <span className="font-semibold text-foreground">
              {rangeStart}–{rangeEnd}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-foreground">{totalFiltered}</span>
          </span>
        </div>
      )}
    </div>
  );
}
