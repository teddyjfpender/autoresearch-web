import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-bg-raised text-fg",
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-6 pb-0", className)}
      {...props}
    />
  )
}

export function CardTitle({ className, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-sm font-medium tracking-tight text-fg-muted", className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6", className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-line px-6 py-4", className)}
      {...props}
    />
  )
}
