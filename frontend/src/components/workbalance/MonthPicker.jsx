import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMonth, toApiMonth } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function parseYearMonth(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function MonthPicker({
  id,
  value = '',
  onChange,
  placeholder = 'Pilih bulan',
  disabled = false,
  clearable = false,
  size = 'default',
  ariaLabel,
  className,
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseYearMonth(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(() => parsed?.year || now.getFullYear());

  useEffect(() => {
    if (open) {
      setViewYear(parsed?.year || new Date().getFullYear());
    }
  }, [open, parsed?.year]);

  const handleSelectMonth = (monthIndex) => {
    const next = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onChange?.(next);
    setOpen(false);
  };

  const handleClear = (event) => {
    event.stopPropagation();
    event.preventDefault();
    onChange?.('');
    setOpen(false);
  };

  const heightClass = size === 'sm' ? 'h-9 text-xs' : 'h-10 text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'w-full justify-between rounded-xl bg-background px-3 font-normal tabular-nums hover:border-hover-border hover:bg-hover-surface hover:translate-y-0',
            heightClass,
            !parsed && 'text-muted-foreground',
            className
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{parsed ? formatMonth(value) : placeholder}</span>
          </span>
          {clearable && parsed && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Hapus periode bulan"
              onClick={handleClear}
              className="ml-1 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-hover-surface-strong hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tahun sebelumnya"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {viewYear}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tahun berikutnya"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_LABELS.map((label, idx) => {
            const isSelected = parsed?.year === viewYear && parsed?.month === idx + 1;
            const isCurrent = now.getFullYear() === viewYear && now.getMonth() === idx;
            return (
              <Button
                key={label}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSelectMonth(idx)}
                className={cn(
                  'h-8 rounded-lg text-xs',
                  !isSelected && isCurrent && 'ring-1 ring-primary/50 font-semibold'
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onChange?.(toApiMonth(new Date()));
              setOpen(false);
            }}
          >
            Bulan ini
          </Button>
          {clearable && parsed && (
            <Button type="button" variant="ghost" size="xs" onClick={handleClear}>
              Hapus
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
