import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const SIZE_CLASSES = {
  sm: 'sm:max-w-md data-[side=right]:sm:max-w-md',
  md: 'sm:max-w-lg data-[side=right]:sm:max-w-lg',
  lg: 'sm:max-w-xl data-[side=right]:sm:max-w-xl',
  xl: 'sm:max-w-2xl data-[side=right]:sm:max-w-2xl',
};

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  children,
  className,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
          className
        )}
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-xs text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <SheetFooter className="border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
