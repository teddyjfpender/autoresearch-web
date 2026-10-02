import { Badge } from "@autoresearch/ui/components/badge"
import { cn } from "@autoresearch/ui/lib/cn"

import type { Challenge } from "@/data/schema"

const LABELS: Record<Challenge["status"], string> = {
  live: "Live",
  staging: "Staging · activation pending",
  closed: "Closed",
}

/** Live breathes; staging is an open ring (not ranking yet); closed has no dot. */
export function StatusBadge({ status }: { status: Challenge["status"] }) {
  return (
    <Badge tone="heat" className="gap-2">
      {status === "closed" ? null : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status === "live" ? "animate-pulse-dot bg-heat" : "border border-heat",
          )}
        />
      )}
      {LABELS[status]}
    </Badge>
  )
}
