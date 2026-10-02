import { Avatar } from "@autoresearch/ui/components/avatar"
import { Badge } from "@autoresearch/ui/components/badge"
import { Formula } from "@autoresearch/ui/components/formula"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import Link from "next/link"

import type { Challenge, Track } from "@/data/schema"
import { submitterOf } from "@/lib/authors"
import { formatDate, formatDateTime } from "@/lib/dates"
import { formatRatio } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { Promotion, Summary } from "@/lib/scoring"

function LeaderCard({
  slug,
  track,
  leader,
  promotions,
  delay,
  baselineCommit,
  baselineMeasured,
}: {
  slug: string
  track: Track
  leader: Promotion | undefined
  promotions: number
  delay: number
  baselineCommit: string
  baselineMeasured: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-label">{track.name} leader</span>
        <Formula className="text-xs text-fg-faint">{track.formula}</Formula>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className="text-5xl font-light tracking-[-0.05em] tabular sm:text-6xl">
            {leader ? <NumberTicker value={leader.score} fractionDigits={3} /> : "1.000"}
          </span>
          <span className="text-fg-muted">×</span>
        </p>
        <p className="mt-2 text-sm text-fg-muted">
          {leader
            ? `Proving time ${formatRatio(leader.scored.rTime)}× · memory ${formatRatio(leader.scored.rMemory)}× baseline`
            : `Baseline holds: stwo-zig ${baselineCommit}, measured ${baselineMeasured}.`}
        </p>
      </div>
      {leader ? (
        <div className="flex min-w-0 items-center gap-2.5 text-sm">
          <Avatar name={submitterOf(leader.scored.card.authors).handle} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{submitterOf(leader.scored.card.authors).handle}</span>
            <span className="truncate text-xs text-fg-faint">
              {formatDateTime(leader.scored.card.submittedAt)} · {formatNumber(promotions)}{" "}
              promotions
            </span>
          </span>
        </div>
      ) : null}
    </>
  )
  const className = "flex h-full flex-col justify-between gap-10 p-6 sm:p-8"
  return (
    <Reveal delay={delay} className="h-full">
      <Spotlight className="h-full">
        {leader ? (
          <Link href={routes.submission(slug, leader.scored.card.id)} className={className}>
            {body}
          </Link>
        ) : (
          <div className={className}>{body}</div>
        )}
      </Spotlight>
    </Reveal>
  )
}

/** One card per track leader, plus the size of the Pareto frontier. */
export function RecordCards({ challenge, summary }: { challenge: Challenge; summary: Summary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {challenge.tracks.map((track, index) => (
        <LeaderCard
          key={track.id}
          slug={challenge.slug}
          track={track}
          leader={summary.leaders[track.id]}
          promotions={summary.promotions[track.id].length}
          delay={index * 0.08}
          baselineCommit={challenge.contract.sourceCommit.slice(0, 8)}
          baselineMeasured={formatDate(challenge.contract.baselineMeasuredAt)}
        />
      ))}
      <Reveal delay={0.24} className="h-full">
        <Spotlight className="flex h-full flex-col justify-between gap-10 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <span className="text-label">Pareto frontier</span>
            <Badge size="sm">{challenge.contract.epoch}</Badge>
          </div>
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-light tracking-[-0.05em] tabular sm:text-6xl">
                <NumberTicker value={summary.frontier.length} />
              </span>
              <span className="text-fg-muted">points</span>
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              {summary.frontier.length === 0
                ? "Only the baseline (1.00, 1.00) so far. Points land here as scorecards are judged."
                : "Scorecards no other beats on both command time and device peak memory, kept even when they win no track."}
            </p>
          </div>
          <p className="text-xs text-fg-faint">{formatNumber(summary.ranked)} ranked scorecards</p>
        </Spotlight>
      </Reveal>
    </div>
  )
}
