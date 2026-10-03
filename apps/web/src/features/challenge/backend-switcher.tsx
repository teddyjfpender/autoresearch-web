import { cn } from "@autoresearch/ui/lib/cn"
import Link from "next/link"

import type { Challenge } from "@/data/schema"
import { routes } from "@/lib/routes"

/** Pill links between the backend routes of one challenge, styled like the segmented control. */
export function BackendSwitcher({ challenge }: { challenge: Challenge }) {
  if (challenge.siblings.length < 2) return null
  return (
    <nav
      aria-label="Backend"
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
            {sibling.id.toUpperCase()}
          </Link>
        )
      })}
    </nav>
  )
}
