import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_8px_18px_-8px_oklch(0.538_0.150_238_/_60%)] dark:hover:brightness-110",
        cta:
          "bg-foreground text-background font-semibold hover:-translate-y-px hover:bg-foreground/88 hover:shadow-[0_10px_20px_-10px_oklch(0.215_0.028_260_/_55%)] dark:hover:shadow-[0_10px_20px_-10px_oklch(0.958_0.006_250_/_30%)]",
        outline:
          "border-border bg-background hover:-translate-y-px hover:border-hover-border hover:bg-hover-surface-strong hover:text-foreground aria-expanded:border-hover-border aria-expanded:bg-hover-surface aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:border-hover-border dark:hover:bg-hover-surface-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:-translate-y-px hover:bg-hover-surface-strong hover:text-foreground aria-expanded:bg-hover-surface aria-expanded:text-foreground",
        ghost:
          "hover:bg-hover-surface-strong hover:text-foreground aria-expanded:bg-hover-surface aria-expanded:text-foreground",
        destructive:
          "bg-destructive/12 text-destructive hover:-translate-y-px hover:bg-destructive/22 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/32 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
