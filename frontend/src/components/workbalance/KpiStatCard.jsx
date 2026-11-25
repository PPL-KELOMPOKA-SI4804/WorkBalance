import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AnimatedNumber } from './AnimatedNumber';
import { StatusBadge } from './StatusBadge';

export function KpiStatCard({
  label,
  value,
  unit,
  icon: Icon,
  status,
  statusTone,
  statusLabel,
  hint,
  progress,
  className,
}) {
  return (
    <div
      data-slot="kpi-stat-card"
      className={cn(
        'group flex flex-col justify-between gap-3.5 rounded-2xl border border-border bg-card p-5 transition-all duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-hover-border hover:bg-hover-surface/45 hover:shadow-[0_10px_24px_-16px_oklch(0.215_0.028_260_/_35%)] dark:hover:bg-hover-surface/55 dark:hover:shadow-none',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground text-balance">
          {label}
        </span>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-all duration-180 group-hover:scale-105 group-hover:bg-primary/15 group-hover:text-primary">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          className="text-[28px] leading-none font-bold tracking-[-0.03em] text-foreground"
        />
        {unit && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {unit}
          </span>
        )}
      </div>

      {typeof progress === 'number' && (
        <Progress
          value={Math.min(100, Math.max(0, progress))}
          className="h-1.5"
        />
      )}

      {(status || statusLabel || hint) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {(status || statusLabel) && (
            <StatusBadge
              status={status}
              tone={statusTone}
              label={statusLabel}
            />
          )}
          {hint && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
