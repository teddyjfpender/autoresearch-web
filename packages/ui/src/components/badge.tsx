import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border text-xs leading-none font-normal whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line text-fg-muted",
        accent: "border-transparent bg-accent-soft text-accent",
        heat: "border-line text-fg-muted",
        solid: "border-transparent bg-fg text-bg",
      },
      size: {
        sm: "h-5 px-2",
        md: "h-6 px-2.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
)

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, size }), className)} {...props} />
  )
}
