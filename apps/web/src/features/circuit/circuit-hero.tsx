import { Badge } from "@autoresearch/ui/components/badge"
import { Container } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ChevronRight } from "lucide-react"

import type { ReactNode } from "react"

import type { CircuitChallenge, CircuitTrack } from "@/data/circuit/schema"
import { formatProduct, formatToffoli, summarizeCircuits } from "@/lib/circuit"
import { formatDate } from "@/lib/dates"
import { routes } from "@/lib/routes"

import { StatusBadge } from "../challenge/status-badge"
import { SectionLink } from "../site/section-link"

/**
 * Compact header of a circuit challenge: identity, the track switch, and four figures computed
 * for the selected track.
 */
export function CircuitHero({
  challenge,
  track,
  switcher,
}: {
  challenge: CircuitChallenge
  track: CircuitTrack
  switcher: ReactNode
}) {
  const { best, fewestToffoli, fewestQubits, reduction, reference } = summarizeCircuits(track)
  const architectureName = new Map(challenge.architectures.map((item) => [item.id, item.name]))
  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: "Best score",
      value: best === null ? "—" : formatProduct(best.score),
      ...(best === null
        ? {}
        : {
            hint: `${formatToffoli(best.toffoli)} Toffolis × ${formatNumber(best.qubits)} qubits · ${architectureName.get(best.architecture) ?? best.architecture}`,
          }),
    },
    {
      label: reference?.kind === "first" ? "Score removed" : "Below the baseline",
      value: reduction === null ? "—" : `${formatNumber(reduction * 100, 0)}%`,
      ...(reference === null
        ? {}
        : {
            hint:
              reference.kind === "baseline"
                ? `baseline ${formatProduct(reference.circuit.score)}: ${formatToffoli(reference.circuit.toffoli)} × ${formatNumber(reference.circuit.qubits)}, the Low et al. 2025 construction`
                : `since the first circuit, ${formatDate(new Date(reference.circuit.unixTime * 1000).toISOString())}`,
          }),
    },
    {
      label: "Fewest Toffolis",
      value: fewestToffoli === null ? "—" : formatToffoli(fewestToffoli.toffoli),
      ...(fewestToffoli === null
        ? {}
        : { hint: `per step, at ${formatNumber(fewestToffoli.qubits)} qubits` }),
    },
    {
      label: "Fewest qubits",
      value: fewestQubits === null ? "—" : formatNumber(fewestQubits.qubits),
      ...(fewestQubits === null
        ? {}
        : { hint: `at ${formatToffoli(fewestQubits.toffoli)} Toffolis per step` }),
    },
  ]

  return (
    <section id="overview" className="relative scroll-mt-24 pt-24 pb-10 sm:pt-28">
      <Container>
        <Reveal y={8}>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 font-mono text-xs text-fg-faint">
              <li>
                <SectionLink
                  href={routes.homeSection("challenges")}
                  className="transition-colors hover:text-fg"
                >
                  Challenges
                </SectionLink>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3" />
              </li>
              <li aria-current="page" className="text-fg-muted">
                {challenge.slug}
              </li>
            </ol>
          </nav>
        </Reveal>

        <div className="mt-6 grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end">
          <div className="max-w-2xl">
            <Reveal y={8} delay={0.05}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={challenge.status} />
                {switcher}
                <Badge>{track.headline}</Badge>
                <Badge>{track.spec}</Badge>
              </div>
            </Reveal>
            <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-normal tracking-[-0.05em]">
              <SplitText text={challenge.name} />
            </h1>
            <Reveal delay={0.2}>
              <p className="mt-4 leading-relaxed text-fg-muted">
                {challenge.headline} {track.summary}
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.3}>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-2">
              {stats.map((stat) => (
                <div key={stat.label} className="border-l border-line pl-4">
                  <dt className="text-label whitespace-nowrap">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-light tracking-tight whitespace-nowrap tabular lg:text-3xl">
                    {stat.value}
                  </dd>
                  {stat.hint === undefined ? null : (
                    <dd className="mt-0.5 text-xs text-fg-faint">{stat.hint}</dd>
                  )}
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
