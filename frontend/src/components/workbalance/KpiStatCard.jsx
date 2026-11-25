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
        'flex flex-col justify-between gap-3.5 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground text-balance">
          {label}
        </span>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
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
