import { formatNumber } from "@autoresearch/ui/lib/format"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { ArrowUpRight } from "lucide-react"

import type { CircuitChallenge } from "@/data/circuit/schema"
import { formatProduct, formatToffoli, summarizeCircuits } from "@/lib/circuit"
import { formatDate } from "@/lib/dates"
import { routes } from "@/lib/routes"

import { StatusBadge } from "../challenge/status-badge"
import { SectionLink } from "../site/section-link"
import { LeadFigure } from "./lead-figure"

/** How many architectures a track lists on the card before the rest are left to its page. */
const ROWS_PER_TRACK = 3

/**
 * A circuit challenge on the landing carousel: the score removed on its most improved track,
 * the best circuit of each track, and each track's leading architectures.
 */
export function CircuitCard({ challenge }: { challenge: CircuitChallenge }) {
  const summaries = challenge.tracks.map((track) => ({ track, ...summarizeCircuits(track) }))
  const lead = summaries.reduce<(typeof summaries)[number] | null>(
    (most, item) =>
      item.reduction !== null && (most === null || item.reduction > (most.reduction ?? 0))
        ? item
        : most,
    null,
  )
  const architectures = new Set(
    challenge.tracks.flatMap((track) => track.board.architectures.map((item) => item.id)),
  )
  const stats = [
    { label: "Tracks", value: challenge.tracks.map((track) => track.name).join(" · ") },
    { label: "Architectures", value: formatNumber(architectures.size) },
    {
      label: "Validated",
      value: formatNumber(
        challenge.tracks.reduce((total, track) => total + track.circuits.length, 0),
      ),
    },
  ]
  return (
    <Spotlight className="group/card h-full">
      <SectionLink
        href={routes.challenge(challenge.slug)}
        className="grid h-full gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_1fr]"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={challenge.status} />
            <span className="font-mono text-xs text-fg-faint">/{challenge.slug}</span>
          </div>
          <LeadFigure
            improvement={{
              value: (lead?.reduction ?? 0) * 100,
              label:
                lead?.first == null
                  ? "no circuits recorded yet"
                  : `less Toffolis × qubits (score) on the ${lead.track.name} track since its first circuit, ${formatDate(new Date(lead.first.unixTime * 1000).toISOString())}`,
            }}
            time={{ seconds: null, label: "no circuits recorded yet" }}
            {...(lead?.best == null
              ? {}
              : {
                  alternate: {
                    value: lead.best.toffoliTimesQubits / 1e6,
                    fractionDigits: 2,
                    suffix: "M",
                    label: `Toffolis × qubits of the best ${lead.track.name} circuit: ${formatToffoli(lead.best.toffoli)} per step at ${formatNumber(lead.best.qubits)} qubits`,
                  },
                })}
          />
          <div>
            <h3 className="text-2xl font-normal tracking-[-0.04em] sm:text-3xl">
              {challenge.name}
            </h3>
            <p className="mt-2 line-clamp-2 max-w-md text-sm text-fg-muted">{challenge.summary}</p>
          </div>
          <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-label">{stat.label}</dt>
                <dd className="mt-1 text-xl font-light tracking-tight whitespace-nowrap tabular">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl bg-bg p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 text-label">
            <span>Best circuit per architecture · Toffolis × qubits</span>
            <span className="text-fg-muted">lower is better</span>
          </div>
          <div className="space-y-4">
            {challenge.tracks.map((track) => {
              const rows = track.board.architectures.slice(0, ROWS_PER_TRACK)
              const largest = Math.max(...rows.map((row) => row.elite.toffoliTimesQubits), 1)
              return (
                <div key={track.id}>
                  <p className="text-xs text-fg-faint">{track.name}</p>
                  {rows.length === 0 ? (
                    <p className="mt-1 text-sm text-fg-faint">No validated circuits yet.</p>
                  ) : null}
                  <ul className="mt-1.5 space-y-2">
                    {rows.map((row, index) => (
                      <li
                        key={row.id}
                        className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-3 text-xs"
                      >
                        <span className="truncate text-fg-muted">{row.name}</span>
                        <span aria-hidden className="relative h-1.5 rounded-full bg-surface">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full ${index === 0 ? "bg-accent" : "bg-fg-faint"}`}
                            style={{
                              width: `${((row.elite.toffoliTimesQubits / largest) * 100).toFixed(2)}%`,
                            }}
                          />
                        </span>
                        <span className="text-right font-mono text-fg tabular">
                          {formatProduct(row.elite.toffoliTimesQubits)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <span className="inline-flex items-center gap-2 self-end text-sm">
            Enter challenge
            <span className="inline-flex size-8 items-center justify-center rounded-full border border-line-strong text-fg transition-[transform,background-color,color] duration-500 ease-out-expo group-hover/card:rotate-45 group-hover/card:bg-fg group-hover/card:text-bg">
              <ArrowUpRight className="size-4" />
            </span>
          </span>
        </div>
      </SectionLink>
    </Spotlight>
  )
}
