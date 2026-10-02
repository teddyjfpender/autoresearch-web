"use client"

import type { ComponentProps, PointerEvent } from "react"

import { cn } from "../lib/cn"

/**
 * Surface whose border and fill light up under the cursor. Position is written to CSS
 * variables so the effect costs no React renders.
 */
export function Spotlight({ className, children, onPointerMove, ...props }: ComponentProps<"div">) {
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty("--spot-x", `${String(event.clientX - rect.left)}px`)
    event.currentTarget.style.setProperty("--spot-y", `${String(event.clientY - rect.top)}px`)
    onPointerMove?.(event)
  }
  return (
    <div
      className={cn(
        "group/spot relative isolate overflow-hidden rounded-2xl border border-line bg-bg-raised transition-colors duration-500 hover:border-line-strong",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        "before:bg-[radial-gradient(28rem_circle_at_var(--spot-x,50%)_var(--spot-y,50%),var(--ar-glow),transparent_70%)]",
        className,
      )}
      onPointerMove={handleMove}
      {...props}
    >
      {children}
    </div>
  )
}
