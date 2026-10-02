import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden",
    "font-normal whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,transform] duration-300 ease-out-expo",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-fg/85",
        accent: "bg-accent text-accent-fg hover:bg-accent-strong",
        secondary: "bg-surface text-fg hover:bg-surface-strong",
        outline: "border border-line-strong text-fg hover:border-fg-faint hover:bg-surface",
        ghost: "text-fg-muted hover:bg-surface hover:text-fg",
        link: "text-fg underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-full px-3 text-xs [&_svg]:size-3.5",
        md: "h-10 rounded-full px-5 text-sm [&_svg]:size-4",
        lg: "h-14 rounded-full px-7 text-base [&_svg]:size-5",
        icon: "size-10 rounded-full [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element instead of a `<button>`, merging props onto it. */
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  )
}
