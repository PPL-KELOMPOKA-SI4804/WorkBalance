import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function RowActionsMenu({
  items = [],
  ariaLabel = 'Menu aksi',
  className,
}) {
  const visibleItems = items.filter((item) => item && !item.hidden);
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('-mr-1.5 flex justify-end', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={ariaLabel}
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {visibleItems.map((item, idx) => {
            if (item.type === 'separator') {
              return <DropdownMenuSeparator key={`sep-${idx}`} />;
            }
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.key || item.label}
                variant={item.variant === 'destructive' ? 'destructive' : 'default'}
                disabled={Boolean(item.disabled)}
                title={item.title}
                onSelect={(event) => {
                  event.stopPropagation();
                  item.onSelect?.();
                }}
              >
                {Icon && <Icon className="size-4" />}
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
