import { cn } from '@/lib/utils';
import { AnimatedNumber } from './AnimatedNumber';
import { StatusBadge } from './StatusBadge';

const CELL_BORDER_CLASSES = [
  'sm:border-r sm:border-b border-border',
  'sm:border-b border-border',
  'sm:border-r border-border',
  '',
];

export function HeroBentoCard({
  metrics = [],
  chartTitle,
  chartSubtitle,
  chartLegend,
  chartActions,
  children,
  className,
}) {
  const safeMetrics = metrics.slice(0, 4);

  return (
    <section
      data-slot="hero-bento-card"
      className={cn(
        'grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card xl:grid-cols-12',
        className
      )}
    >
      {/* Left 5 cols: 2x2 Divided KPI Grid (HRDashboard Home-V1 Signature) */}
      <div className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-2 sm:divide-y-0 xl:col-span-5 xl:border-r xl:border-b-0">
        {safeMetrics.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key || item.label || index}
              className={cn(
                'flex flex-col justify-between gap-4 p-5 sm:p-6',
                CELL_BORDER_CLASSES[index] || ''
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {Icon && (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                )}
                {item.topRight}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <AnimatedNumber
                      value={item.value}
                      className="text-[30px] leading-none font-bold tracking-[-0.03em] text-foreground"
                    />
                    {item.unit && (
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {item.unit}
                      </span>
                    )}
                  </div>
                  {(item.status || item.statusLabel) && (
                    <StatusBadge
                      status={item.status}
                      tone={item.statusTone}
                      label={item.statusLabel}
                      showDot={item.showDot ?? true}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground text-balance">
                    {item.label}
                  </span>
                  {item.hint && (
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {item.hint}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right 7 cols: Integrated Chart Panel */}
      <div className="flex flex-col justify-between gap-5 p-5 sm:p-6 xl:col-span-7">
        {(chartTitle || chartSubtitle || chartLegend || chartActions) && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              {chartTitle && (
                <h2 className="text-base font-bold tracking-[-0.02em] text-foreground">
                  {chartTitle}
                </h2>
              )}
              {chartSubtitle && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {chartSubtitle}
                </p>
              )}
              {chartLegend && (
                <div className="flex flex-wrap items-center gap-4 pt-0.5 text-xs text-muted-foreground">
                  {chartLegend}
                </div>
              )}
            </div>
            {chartActions && (
              <div className="flex flex-wrap items-center gap-2">
                {chartActions}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  );
}
