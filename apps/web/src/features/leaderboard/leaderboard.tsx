"use client"

import { Button } from "@autoresearch/ui/components/button"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Formula } from "@autoresearch/ui/components/formula"
import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { Tooltip } from "@autoresearch/ui/components/tooltip"
import { cn } from "@autoresearch/ui/lib/cn"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"

import type { Track, TrackId } from "@/data/schema"
import { formatDateTime } from "@/lib/dates"
import { formatChange, formatRatio, formatScore } from "@/lib/format"
import { METRICS } from "@/lib/metrics"
import { routes } from "@/lib/routes"
import { paretoFrontier, promotions, TRACK_IDS, type Scored } from "@/lib/scoring"

import { SectionLink } from "../site/section-link"
import { SolverCell } from "./solver-cell"

type View = TrackId | "pareto" | "all"

interface Row {
  key: string
  rank: number
  scored: Scored
  score: ReactNode
  change: ReactNode
}

const PAGE = 12

const VIEW_COPY: Record<View, string> = {
  latency: "Promoted latency leaders, newest first. Each beat the standing leader by at least 1%.",
  memory: "Promoted memory leaders, newest first, under the latency guards.",
  balanced: "Promoted balanced leaders, newest first, under both sets of guards.",
  pareto:
    "Every scorecard no other one beats on both command time and device peak memory, from leanest to fastest.",
  all: "Every ranked scorecard, newest first, with which tracks it was eligible for.",
}

function Eligibility({ scored, tracks }: { scored: Scored; tracks: readonly Track[] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {tracks.map((track) => {
        const result = scored.tracks[track.id]
        return (
          <Tooltip
            key={track.id}
            content={
              result.eligible ? (
                `${track.name}: eligible`
              ) : (
                <span className="block space-y-1">
                  <span className="block">{track.name}: barred by a guard</span>
                  {result.failures.map((failure) => (
                    <span key={failure} className="block font-mono text-fg-faint">
                      <Formula>{failure}</Formula>
                    </span>
                  ))}
                </span>
              )
            }
          >
            <button
              type="button"
              aria-label={`${track.name} ${result.eligible ? "eligible" : "ineligible"}`}
              className={cn(
                "relative z-10 inline-flex h-5 min-w-5 cursor-help items-center justify-center rounded-full border px-1.5 font-mono text-[0.625rem]",
                result.eligible
                  ? "border-line-strong text-fg-muted"
                  : "border-dashed border-bad/50 text-bad",
              )}
            >
              {track.name.charAt(0)}
            </button>
          </Tooltip>
        )
      })}
    </span>
  )
}

export function Leaderboard({
  slug,
  scored,
  tracks,
  minImprovement,
  activation,
}: {
  slug: string
  scored: readonly Scored[]
  tracks: readonly Track[]
  minImprovement: number
  activation: { done: number; total: number }
}) {
  const [view, setView] = useState<View>("balanced")
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo<Row[]>(() => {
    if (view === "pareto") {
      return paretoFrontier(scored).map((entry, index) => ({
        key: entry.card.id,
        rank: index + 1,
        scored: entry,
        score:
          entry.tracks.balanced.score === null ? "—" : formatScore(entry.tracks.balanced.score),
        change: <Eligibility scored={entry} tracks={tracks} />,
      }))
    }
    if (view === "all") {
      return scored.toReversed().map((entry, index) => ({
        key: entry.card.id,
        rank: index + 1,
        scored: entry,
        score:
          entry.tracks.balanced.score === null ? "—" : formatScore(entry.tracks.balanced.score),
        change: <Eligibility scored={entry} tracks={tracks} />,
      }))
    }
    return promotions(scored, view, minImprovement).map((promotion) => ({
      key: promotion.scored.card.id,
      rank: promotion.rank,
      scored: promotion.scored,
      score: formatScore(promotion.score),
      change: (
        <span className="text-good">{formatChange(promotion.score / promotion.previous)}</span>
      ),
    }))
  }, [scored, view, tracks, minImprovement])

  const shown = expanded ? rows : rows.slice(0, PAGE)
  const isTrack = TRACK_IDS.some((track) => track === view)
  const scoreHeader = isTrack ? "Score" : "Balanced"
  const changeHeader = isTrack ? "vs leader" : "Tracks"
  const headers: { key: string; label: ReactNode; hint?: string }[] = [
    { key: "rank", label: "#" },
    { key: "solver", label: "Solver" },
    {
      key: "rt",
      label: (
        <>
          Time <Formula>{METRICS.rTime.symbol}</Formula>
        </>
      ),
      hint: `${METRICS.rTime.definition} ${METRICS.rTime.hint}.`,
    },
    {
      key: "rm",
      label: (
        <>
          Memory <Formula>{METRICS.rMemory.symbol}</Formula>
        </>
      ),
      hint: `${METRICS.rMemory.definition} ${METRICS.rMemory.hint}.`,
    },
    { key: "score", label: scoreHeader },
    { key: "change", label: changeHeader },
    { key: "ranked", label: "Ranked" },
    { key: "link", label: "" },
  ]

  return (
    <Section id="leaderboard">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Reveal>
              <Eyebrow index="02">Leaderboard</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6">
                Three tracks, <em className="font-display font-normal">one</em> measurement.
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <SegmentedControl
                aria-label="Leaderboard view"
                value={view}
                onValueChange={(next) => {
                  setView(next)
                  setExpanded(false)
                }}
                options={[
                  ...tracks.map((track) => ({ value: track.id, label: track.name })),
                  { value: "pareto" as const, label: "Pareto" },
                  { value: "all" as const, label: "All" },
                ]}
              />
              <p className="max-w-sm text-sm text-fg-muted sm:text-right">{VIEW_COPY[view]}</p>
            </div>
          </Reveal>
        </div>

        {scored.length === 0 ? (
          <Reveal delay={0.15}>
            <div className="mt-12 rounded-2xl border border-dashed border-line-strong p-8 sm:p-12">
              <p className="text-label">No ranked submissions yet</p>
              <p className="mt-4 max-w-2xl text-2xl font-light tracking-tight">
                The pinned baseline holds every track at 1.000×. The first entries appear here as
                judge-signed rank receipts once the H200 judge is activated.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <p className="text-sm text-fg-muted">
                  {activation.done} of {activation.total} activation gates done
                </p>
                <span
                  aria-hidden
                  className="relative h-1 w-48 overflow-hidden rounded-full bg-surface"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    style={{
                      width: `${String((activation.done / Math.max(1, activation.total)) * 100)}%`,
                    }}
                  />
                </span>
                <Button asChild variant="outline" size="sm">
                  <SectionLink href={routes.challengeSection(slug, "judging")}>
                    See what&apos;s left
                  </SectionLink>
                </Button>
                <Button asChild size="sm">
                  <SectionLink href={routes.challengeSection(slug, "participate")}>
                    Prepare a candidate
                  </SectionLink>
                </Button>
              </div>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal delay={0.15}>
              <div className="mt-12 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-sm">
                  <caption className="sr-only">{VIEW_COPY[view]}</caption>
                  <thead className="hidden border-b border-line lg:table-header-group">
                    <tr>
                      {headers.map((header, index) => (
                        <th
                          key={header.key}
                          scope="col"
                          className={cn(
                            "h-12 px-4 text-label font-normal",
                            index >= 2 && index <= 5 ? "text-right" : "text-left",
                          )}
                        >
                          {header.key === "link" ? (
                            <span className="sr-only">Open</span>
                          ) : header.hint === undefined ? (
                            header.label
                          ) : (
                            <Tooltip content={header.hint}>
                              <button
                                type="button"
                                className="cursor-help underline decoration-line-strong decoration-dotted underline-offset-4"
                              >
                                {header.label}
                              </button>
                            </Tooltip>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false} mode="popLayout">
                      {shown.map((row, index) => (
                        <motion.tr
                          key={`${view}-${row.key}`}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.5,
                            delay: Math.min(index, PAGE) * 0.02,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="group relative grid grid-cols-[2.5rem_1fr_auto] gap-x-3 gap-y-2 border-b border-line px-4 py-4 transition-colors duration-200 last:border-0 hover:bg-surface/60 lg:table-row lg:p-0"
                        >
                          <td className="font-mono text-xs text-fg-faint tabular lg:w-14 lg:px-4 lg:py-4">
                            {String(row.rank).padStart(2, "0")}
                          </td>
                          <td className="min-w-0 lg:px-4 lg:py-3">
                            <SolverCell card={row.scored.card} />
                          </td>
                          <td className="text-right font-mono text-xs tabular lg:hidden">
                            {row.score}
                          </td>
                          <td className="hidden px-4 text-right font-mono text-xs tabular lg:table-cell">
                            {formatRatio(row.scored.rTime)}
                          </td>
                          <td className="hidden px-4 text-right font-mono text-xs tabular lg:table-cell">
                            {formatRatio(row.scored.rMemory)}
                          </td>
                          <td className="hidden px-4 text-right font-mono text-xs text-fg tabular lg:table-cell">
                            {row.score}
                          </td>
                          <td className="col-span-2 col-start-2 font-mono text-xs tabular lg:px-4 lg:text-right">
                            {row.change}
                          </td>
                          <td className="hidden px-4 font-mono text-xs whitespace-nowrap text-fg-faint lg:table-cell">
                            {formatDateTime(row.scored.card.submittedAt)}
                          </td>
                          <td className="absolute inset-0 lg:static lg:w-12 lg:pr-4">
                            <Link
                              href={routes.submission(slug, row.scored.card.id)}
                              className="flex size-full items-center justify-end text-fg-faint transition-colors group-hover:text-fg"
                              aria-label={`Open scorecard ${row.scored.card.id}`}
                            >
                              <ArrowUpRight className="hidden size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 lg:block" />
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </Reveal>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-label">
                {rows.length} rows · {scored.length} judge-signed scorecards ·{" "}
                <Formula>{METRICS.rTime.symbol}</Formula> and{" "}
                <Formula>{METRICS.rMemory.symbol}</Formula> are command time and device peak memory
                relative to the baseline (1.00), lower is better
              </p>
              {rows.length > PAGE ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpanded((value) => !value)
                  }}
                  aria-expanded={expanded}
                >
                  {expanded ? "Show fewer" : `Show all ${String(rows.length)}`}
                  <ChevronDown
                    className={cn(
                      "transition-transform duration-500 ease-out-expo",
                      expanded && "rotate-180",
                    )}
                  />
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Container>
    </Section>
  )
}
