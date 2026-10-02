import { Avatar } from "@autoresearch/ui/components/avatar"
import { Button } from "@autoresearch/ui/components/button"
import { ArrowUpRight } from "lucide-react"

import { formatDate } from "@/lib/dates"
import type { ResearchActivity, ResearchItem } from "@/lib/github-research"

/** Strip Markdown syntax from a GitHub body excerpt so it reads as plain prose. */
function plain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(^|\s)[#>]+\s*/g, "$1")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

function ItemList({ items }: { items: readonly ResearchItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 py-4"
          >
            <Avatar name={item.author?.login ?? "?"} src={item.author?.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate transition-colors group-hover:text-fg-muted">
                {item.title}
              </span>
              {item.excerpt === "" ? null : (
                <span className="mt-1 line-clamp-2 block text-sm text-fg-muted">
                  {plain(item.excerpt)}
                </span>
              )}
              <span className="mt-1 block text-xs text-fg-faint">
                #{item.number} · {item.detail}
                {item.author ? ` · ${item.author.login}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-fg-faint">
              {formatDate(item.updatedAt)}
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Live GitHub research threads and PRs. Claims here are unverified until judged. */
export function DiscussionPanel({
  activity,
  discussionsUrl,
  pullsUrl,
}: {
  activity: ResearchActivity
  discussionsUrl: string
  pullsUrl: string
}) {
  const { discussions, pulls } = activity
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="discussion-threads">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h3 id="discussion-threads" className="text-lg tracking-tight">
            Discussions
          </h3>
          <Button asChild variant="ghost" size="sm" className="-mr-3">
            <a href={discussionsUrl} target="_blank" rel="noreferrer">
              Start a thread
              <ArrowUpRight />
            </a>
          </Button>
        </div>
        {discussions === null ? (
          <p className="py-6 text-sm text-fg-muted">
            Discussions couldn&apos;t be loaded here.{" "}
            <a
              href={discussionsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-fg underline underline-offset-4"
            >
              Read them on GitHub
            </a>
            .
          </p>
        ) : discussions.length === 0 ? (
          <p className="py-6 text-sm text-fg-muted">
            No threads yet. Ideas, results and questions all belong here.
          </p>
        ) : (
          <ItemList items={discussions} />
        )}
      </section>
      <section aria-labelledby="discussion-pulls">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h3 id="discussion-pulls" className="text-lg tracking-tight">
            Pull requests
          </h3>
          <Button asChild variant="ghost" size="sm" className="-mr-3">
            <a href={pullsUrl} target="_blank" rel="noreferrer">
              All PRs
              <ArrowUpRight />
            </a>
          </Button>
        </div>
        {pulls === null || pulls.length === 0 ? (
          <p className="py-6 text-sm text-fg-muted">
            {pulls === null ? "Pull requests couldn't be loaded here." : "No pull requests yet."}
          </p>
        ) : (
          <ItemList items={pulls.slice(0, 8)} />
        )}
      </section>
    </div>
  )
}
