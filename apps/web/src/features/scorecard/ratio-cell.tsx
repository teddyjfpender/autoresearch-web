import { cn } from "@autoresearch/ui/lib/cn"

import { formatChange, formatRatio } from "@/lib/format"

/**
 * A ratio vs baseline drawn as a bar diverging from a centre line: left is better (less
 * time / memory), right is worse. `guard` marks the limit a track enforces.
 */
export function RatioCell({ ratio, guard }: { ratio: number; guard?: number }) {
  // Map log-ratio into ±50% of the track width, clamped.
  const offset = Math.max(-1, Math.min(1, Math.log(ratio) / Math.log(2))) * 50
  const over = guard !== undefined && ratio > guard
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 w-28 shrink-0 rounded-full bg-surface" aria-hidden>
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
        <span
          className={cn(
            "absolute inset-y-0 rounded-full",
            ratio <= 1 ? "bg-good" : over ? "bg-bad" : "bg-fg-faint",
          )}
          style={
            ratio <= 1
              ? { right: "50%", width: `${String(-offset)}%` }
              : { left: "50%", width: `${String(offset)}%` }
          }
        />
      </div>
      <span className={cn("w-24 font-mono text-xs tabular", over ? "text-bad" : "text-fg-muted")}>
        {formatRatio(ratio)} <span className="text-fg-faint">{formatChange(ratio, 0)}</span>
      </span>
    </div>
  )
}
