import { cn } from '@/lib/utils';

function BrandSymbol({ className }) {
  return (
    <svg
      viewBox="16 18 224 220"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect
        x="48"
        y="58"
        width="48"
        height="140"
        rx="24"
        fill="var(--brand-blue)"
      />
      <rect
        x="104"
        y="20"
        width="48"
        height="216"
        rx="24"
        fill="var(--chart-2)"
      />
      <rect
        x="160"
        y="58"
        width="48"
        height="140"
        rx="24"
        fill="var(--chart-3)"
      />
      <path
        d="M 18,154 C 66,78 190,78 238,154 C 183,105 73,105 18,154 Z"
        fill="currentColor"
        className="text-foreground"
      />
    </svg>
  );
}

export function BrandLogo({ variant = 'horizontal', className }) {
  if (variant === 'mark') {
    return (
      <span
        data-slot="brand-logo"
        className={cn('inline-flex items-center justify-center', className)}
        aria-label="WorkBalance"
      >
        <BrandSymbol className="size-7" />
      </span>
    );
  }

  if (variant === 'lockup') {
    return (
      <span
        data-slot="brand-logo"
        className={cn('inline-flex items-center gap-3 select-none', className)}
      >
        <BrandSymbol className="size-11" />
        <span className="flex flex-col">
          <span className="font-heading text-[28px] leading-[1.08] font-bold tracking-[-0.03em]">
            <span className="text-foreground">Work</span>
            <span className="text-brand-blue">Balance</span>
          </span>
          <span className="mt-0.5 text-xs font-medium tracking-[0.04em] text-muted-foreground">
            Decent Work, Better Life
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      data-slot="brand-logo"
      className={cn('inline-flex items-center gap-2.5 select-none', className)}
    >
      <BrandSymbol className="size-8" />
      <span className="font-heading text-[21px] leading-none font-bold tracking-[-0.03em]">
        <span className="text-foreground">Work</span>
        <span className="text-brand-blue">Balance</span>
      </span>
    </span>
  );
}
