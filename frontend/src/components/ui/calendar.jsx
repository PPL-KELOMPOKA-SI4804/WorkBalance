import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { id as idLocale } from 'date-fns/locale';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = idLocale,
  weekStartsOn = 1,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      weekStartsOn={weekStartsOn}
      className={cn('p-2.5 select-none', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-3 sm:flex-row',
        month: 'flex w-full flex-col gap-3',
        month_caption: 'relative flex h-8 items-center justify-center px-8',
        caption_label: 'text-sm font-semibold text-foreground',
        nav: 'absolute inset-x-0 top-0 flex h-8 items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'size-7 rounded-lg text-muted-foreground hover:text-foreground'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'size-7 rounded-lg text-muted-foreground hover:text-foreground'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-8 text-center text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative size-8 p-0 text-center text-xs focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 rounded-lg p-0 text-xs font-normal tabular-nums aria-selected:opacity-100'
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:font-medium',
        range_start:
          'rounded-l-lg bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-medium',
        range_middle:
          'bg-primary/15 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:text-foreground [&>button]:hover:bg-primary/20',
        range_end:
          'rounded-r-lg bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-medium',
        today:
          '[&>button]:ring-1 [&>button]:ring-primary/50 [&>button]:font-semibold',
        outside: 'text-muted-foreground opacity-45',
        disabled: 'text-muted-foreground opacity-40 pointer-events-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation = 'left', className: iconClass }) => {
          if (orientation === 'right') {
            return <ChevronRight className={cn('size-4', iconClass)} />;
          }
          if (orientation === 'up') {
            return <ChevronUp className={cn('size-4', iconClass)} />;
          }
          if (orientation === 'down') {
            return <ChevronDown className={cn('size-4', iconClass)} />;
          }
          return <ChevronLeft className={cn('size-4', iconClass)} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
