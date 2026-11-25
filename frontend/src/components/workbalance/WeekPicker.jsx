import { useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatWeek, getIsoWeekRange, toApiWeek } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function WeekPicker({
  id,
  value = '',
  onChange,
  placeholder = 'Pilih minggu',
  disabled = false,
  clearable = false,
  size = 'default',
  ariaLabel,
  className,
}) {
  const [open, setOpen] = useState(false);
  const range = getIsoWeekRange(value);

  const handleDayClick = (day) => {
    if (!day) return;
    const nextWeek = toApiWeek(day);
    if (nextWeek) {
      onChange?.(nextWeek);
      setOpen(false);
    }
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
            !range && 'text-muted-foreground',
            className
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{range ? formatWeek(value) : placeholder}</span>
          </span>
          {clearable && range && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Hapus periode minggu"
              onClick={handleClear}
              className="ml-1 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-hover-surface-strong hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={range ? { from: range.start, to: range.end } : undefined}
          defaultMonth={range?.start || new Date()}
          onDayClick={handleDayClick}
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleDayClick(new Date())}
          >
            Minggu ini
          </Button>
          {clearable && range && (
            <Button type="button" variant="ghost" size="xs" onClick={handleClear}>
              Hapus
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
