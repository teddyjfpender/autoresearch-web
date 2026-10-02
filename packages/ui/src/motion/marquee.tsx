import type { CSSProperties, ReactNode } from "react"

import { cn } from "../lib/cn"

export interface MarqueeProps {
  children: ReactNode
  /** Seconds for one full loop. */
  duration?: number
  reverse?: boolean
  className?: string
}

/** Infinite horizontal ticker. Content is duplicated once; hover pauses it. */
export function Marquee({ children, duration = 40, reverse = false, className }: MarqueeProps) {
  const track = "flex w-max shrink-0 items-center gap-[inherit] pr-[inherit]"
  return (
    <div
      className={cn("group/marquee flex gap-10 overflow-hidden mask-fade-x", className)}
      style={{ "--marquee-duration": `${String(duration)}s` } as CSSProperties}
    >
      <div
        className={cn(
          "flex w-max animate-marquee gap-[inherit] group-hover/marquee:[animation-play-state:paused]",
          reverse && "[animation-direction:reverse]",
        )}
      >
        <div className={track}>{children}</div>
        <div className={track} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}
