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

/**
 * A circuit-challenge track on the landing carousel: the score removed since the track's first
 * circuit, and the best circuit of each architecture.
 */
export function CircuitCard({ challenge }: { challenge: CircuitChallenge }) {
  const { best, reduction, first } = summarizeCircuits(challenge)
  const since = first === null ? "" : formatDate(new Date(first.unixTime * 1000).toISOString())
  const rows = challenge.board.architectures.map((architecture) => ({
    id: architecture.id,
    label: architecture.name,
    value: architecture.elite.toffoliTimesQubits,
    display: formatProduct(architecture.elite.toffoliTimesQubits),
  }))
  const largest = Math.max(...rows.map((row) => row.value), 1)
  const stats = [
    { label: "Architectures", value: formatNumber(challenge.board.architectures.length) },
    {
      label: "Best circuit",
      value: best === null ? "—" : `${formatToffoli(best.toffoli)} × ${formatNumber(best.qubits)}`,
    },
    { label: "Validated", value: formatNumber(challenge.circuits.length) },
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
              value: (reduction ?? 0) * 100,
              label:
                reduction === null
                  ? "no circuits recorded yet"
                  : `less Toffolis × qubits (score) since the first circuit, ${since}`,
            }}
            time={{ seconds: null, label: "no circuits recorded yet" }}
            {...(best === null
              ? {}
              : {
                  alternate: {
                    value: best.toffoliTimesQubits / 1e6,
                    fractionDigits: 2,
                    suffix: "M",
                    label: `Toffolis × qubits of the best circuit: ${formatToffoli(best.toffoli)} per step at ${formatNumber(best.qubits)} qubits`,
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
          {rows.length === 0 ? (
            <p className="text-sm text-fg-faint">No validated circuits on this track yet.</p>
          ) : null}
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li
                key={row.id}
                className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-3 text-xs"
              >
                <span className="truncate text-fg-muted">{row.label}</span>
                <span aria-hidden className="relative h-1.5 rounded-full bg-surface">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${index === 0 ? "bg-accent" : "bg-fg-faint"}`}
                    style={{ width: `${((row.value / largest) * 100).toFixed(2)}%` }}
                  />
                </span>
                <span className="text-right font-mono text-fg tabular">{row.display}</span>
              </li>
            ))}
          </ul>
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
