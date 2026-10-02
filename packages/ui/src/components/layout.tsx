import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

/** Horizontal page gutter + max width. Every section aligns to this. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-12", className)}
      {...props}
    />
  )
}

export function Section({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("relative scroll-mt-24 py-24 sm:py-32 lg:py-40", className)}
      {...props}
    />
  )
}

export type EyebrowProps = ComponentProps<"p"> & { index?: string }

/** Small monospace label above section headings, optionally numbered ("01"). */
export function Eyebrow({ className, index, children, ...props }: EyebrowProps) {
  return (
    <p
      data-slot="eyebrow"
      className={cn("flex items-center gap-3 text-label", className)}
      {...props}
    >
      {index === undefined ? null : <span className="font-mono tabular">{index}</span>}
      {index === undefined ? null : <span className="h-px w-6 bg-line-strong" aria-hidden />}
      {children}
    </p>
  )
}

export function Heading({ className, children, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      data-slot="heading"
      className={cn(
        "text-4xl leading-[1] font-normal tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  )
}

export function Separator({ className, ...props }: ComponentProps<"hr">) {
  return <hr className={cn("border-0 border-t border-line", className)} {...props} />
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface px-1 font-mono text-[0.625rem] text-fg-muted",
        className,
      )}
      {...props}
    />
  )
}
