import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, className }) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
