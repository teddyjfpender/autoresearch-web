import type { ReactNode } from "react"

import { cn } from "../lib/cn"

export interface StatProps {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  className?: string
}

/** Label / big number / unit / hint, used for records and summary figures. */
export function Stat({ label, value, unit, hint, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-label">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-4xl font-light tracking-[-0.04em] tabular sm:text-5xl">{value}</span>
        {unit === undefined ? null : <span className="text-sm text-fg-muted">{unit}</span>}
      </span>
      {hint === undefined ? null : <span className="text-sm text-fg-muted">{hint}</span>}
    </div>
  )
}
