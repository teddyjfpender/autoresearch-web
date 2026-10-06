import { cn } from "@autoresearch/ui/lib/cn"
import Link from "next/link"

import type { CircuitChallenge } from "@/data/circuit/schema"
import { routes } from "@/lib/routes"

/** Pill links between the tracks of one circuit challenge. */
export function TrackSwitcher({ challenge }: { challenge: CircuitChallenge }) {
  if (challenge.siblings.length < 2) return null
  return (
    <nav
      aria-label="Track"
      className="inline-flex items-center gap-0.5 rounded-full border border-line p-0.5"
    >
      {challenge.siblings.map((sibling) => {
        const active = sibling.slug === challenge.slug
        return (
          <Link
            key={sibling.slug}
            href={routes.challenge(sibling.slug)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 text-xs transition-colors duration-300",
              active ? "bg-surface-strong text-fg" : "text-fg-faint hover:text-fg-muted",
            )}
          >
            {sibling.name}
          </Link>
        )
      })}
    </nav>
  )
}
