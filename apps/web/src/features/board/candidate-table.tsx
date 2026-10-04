"use client"

import { Avatar } from "@autoresearch/ui/components/avatar"
import { Badge } from "@autoresearch/ui/components/badge"
import { cn } from "@autoresearch/ui/lib/cn"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"

import { Formula } from "@autoresearch/ui/components/formula"

import type { Family, Track } from "@/data/schema"
import { REVIEW_STATE_LABEL, scoreFor, type BucketId, type Candidate } from "@/lib/candidates"
import { formatSeconds } from "@/lib/format"

import { RatioCell } from "../scorecard/ratio-cell"
import type { ChartMode } from "./performance-chart"

const fmt = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 3)}×`)

/** Per-case breakout for one candidate: diverging ratio bars grouped by family. */
function Breakout({ candidate, families }: { candidate: Candidate; families: readonly Family[] }) {
  return (
    <div className="space-y-6 px-4 pt-2 pb-6 sm:px-6">
      <p className="max-w-3xl text-sm text-fg-muted">{candidate.decision}</p>
      {families.map((family) => {
        const rows = candidate.cases.filter((item) => item.family === family.id)
        if (rows.length === 0) return null
        return (
          <div key={family.id}>
            <p className="text-label">{family.name}</p>
            <ul className="mt-2 divide-y divide-line">
              {rows.map((row) => (
                <li
                  key={row.caseId}
                  className="grid grid-cols-1 gap-x-6 gap-y-1 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,11rem)] sm:items-center"
                >
                  <span className="truncate">{row.title}</span>
                  <RatioCell ratio={row.ratio} />
                  <span className="font-mono text-xs text-fg-muted tabular sm:text-right">
                    {formatSeconds(row.baselineS)} → {formatSeconds(row.candidateS)}
                    {row.candidatePeakGiB === null
                      ? null
                      : ` · ${formatNumber(row.candidatePeakGiB)} GiB`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <p className="text-label">
        Proof time, candidate ÷ baseline, medians of {String(candidate.samplesPerArm)} paired
        samples per arm. Left of centre is faster; peak memory is shown for capacity only.
        {candidate.coverage.measured < candidate.coverage.total
          ? ` ${String(candidate.coverage.measured)} of ${String(candidate.coverage.total)} cases measured.`
          : ""}
      </p>
    </div>
  )
}

/**
 * Reviewed candidate PRs, best first on the selected track and job type. A row opens its per-case
 * breakdown; the chart and table share the selection.
 */
export function CandidateTable({
  candidates,
  families,
  tracks,
  mode,
  bucket,
  selected,
  onSelect,
}: {
  candidates: readonly Candidate[]
  families: readonly Family[]
  tracks: readonly Track[]
  mode: ChartMode
  bucket: BucketId
  selected: number | null
  onSelect: (prNumber: number | null) => void
}) {
  // Rank by the selected track; the Pareto view ranks by the balanced score.
  const track = mode === "pareto" ? "balanced" : mode
  const trackName = tracks.find((item) => item.id === track)?.name ?? ""
  const rows = useMemo(
    () =>
      candidates.toSorted((a, b) => {
        const difference =
          (scoreFor(b, track, bucket) ?? -Infinity) - (scoreFor(a, track, bucket) ?? -Infinity)
        return difference === 0 || Number.isNaN(difference) ? b.prNumber - a.prNumber : difference
      }),
    [candidates, track, bucket],
  )
  const columns =
    "grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_1.5rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_8.5rem_6rem_1.5rem]"

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div
        className={cn("hidden gap-4 border-b border-line px-4 py-3 sm:grid sm:px-6", columns)}
        aria-hidden
      >
        <span className="text-label">#</span>
        <span className="text-label">Candidate</span>
        <span className="text-label">Review</span>
        <span className="text-right text-label">
          <Formula>R_T</Formula> · <Formula>R_M</Formula>
        </span>
        <span className="text-right text-label">{trackName}</span>
        <span />
      </div>
      <ul>
        {rows.map((candidate, index) => {
          const open = selected === candidate.prNumber
          const panelId = `candidate-${String(candidate.prNumber)}`
          return (
            <li key={candidate.prNumber} className="border-b border-line last:border-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                  onSelect(open ? null : candidate.prNumber)
                }}
                className={cn(
                  "grid w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors duration-200 hover:bg-surface/60 sm:px-6",
                  columns,
                  open && "bg-surface/40",
                )}
              >
                <span className="font-mono text-xs text-fg-faint tabular">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={candidate.author?.login ?? `#${String(candidate.prNumber)}`}
                    src={candidate.author?.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="line-clamp-2 block sm:truncate">{candidate.title}</span>
                    <span className="block truncate text-xs text-fg-faint">
                      #{candidate.prNumber}
                      {candidate.author ? ` · ${candidate.author.login}` : ""}
                    </span>
                  </span>
                </span>
                <span className="hidden sm:block">
                  <Badge
                    size="sm"
                    tone={candidate.reviewState === "promoted_direct" ? "accent" : "neutral"}
                  >
                    {REVIEW_STATE_LABEL[candidate.reviewState]}
                  </Badge>
                </span>
                <span className="hidden text-right font-mono text-xs text-fg-muted tabular sm:block">
                  {candidate.buckets[bucket] === null
                    ? "—"
                    : `${formatNumber(candidate.buckets[bucket].rTime, 3)} · ${formatNumber(candidate.buckets[bucket].rMemory, 3)}`}
                </span>
                <span className="text-right font-mono text-sm text-fg tabular">
                  {fmt(scoreFor(candidate, track, bucket))}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 justify-self-end text-fg-faint transition-transform duration-500 ease-out-expo",
                    open && "rotate-180 text-fg",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={panelId}
                    key="breakout"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <Breakout candidate={candidate} families={families} />
                    {candidate.url === null ? null : (
                      <a
                        href={candidate.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group mx-4 mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg sm:mx-6"
                      >
                        Open PR #{candidate.prNumber}
                        <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
