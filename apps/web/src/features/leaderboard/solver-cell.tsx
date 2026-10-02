import { AvatarStack } from "@autoresearch/ui/components/avatar"
import { Badge } from "@autoresearch/ui/components/badge"
import { Tooltip } from "@autoresearch/ui/components/tooltip"

import type { Scorecard } from "@/data/schema"
import { authorLine } from "@/lib/authors"

export function SolverCell({ card }: { card: Scorecard }) {
  const names = card.authors.map((author) => author.handle)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Tooltip
        content={
          <ul className="space-y-1">
            {card.authors.map((author) => (
              <li key={author.handle} className="flex justify-between gap-6">
                <span>{author.handle}</span>
                <span className="text-fg-faint capitalize">{author.role}</span>
              </li>
            ))}
          </ul>
        }
      >
        <button
          type="button"
          className="relative z-10 cursor-help rounded-full"
          aria-label="Show authors"
        >
          <AvatarStack names={names} size="sm" />
        </button>
      </Tooltip>
      <div className="min-w-0">
        <p className="truncate">{authorLine(card.authors)}</p>
        <p className="truncate text-xs text-fg-faint">{card.title}</p>
      </div>
      {card.model === null ? null : (
        <Badge size="sm" className="hidden xl:inline-flex">
          {card.model}
        </Badge>
      )}
    </div>
  )
}
