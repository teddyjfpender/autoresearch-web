import { Badge } from "@autoresearch/ui/components/badge"
import { Container } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ChevronRight } from "lucide-react"

import type { ReactNode } from "react"

import type { ScriptChallenge, ScriptTrack } from "@/data/script/schema"
import { routes } from "@/lib/routes"
import { formatCounts, formatScore, formatWork, summarizeScripts } from "@/lib/script"

import { StatusBadge } from "../challenge/status-badge"
import { SectionLink } from "../site/section-link"

/**
 * Compact header of a script challenge: identity, the track switch, and four figures computed
 * for the selected track.
 */
export function ScriptHero({
  challenge,
  track,
  switcher,
}: {
  challenge: ScriptChallenge
  track: ScriptTrack
  switcher: ReactNode
}) {
  const { best, fewestBytes, fewestOpcodes, reduction } = summarizeScripts(track)
  const { baseline } = track
  const architectureName = new Map(challenge.architectures.map((item) => [item.id, item.name]))
  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: "Best score",
      value: best === null ? "—" : formatScore(best.score),
      ...(best === null
        ? {}
        : {
            hint: `${formatCounts(best)} · ${architectureName.get(best.architecture) ?? best.architecture}`,
          }),
    },
    {
      label: "Below the baseline",
      value: reduction === null ? "—" : `${formatNumber(reduction * 100, 0)}%`,
      ...(baseline === null
        ? {}
        : {
            hint: `baseline ${formatScore(baseline.score)}: ${formatCounts(baseline)}, the paper's script`,
          }),
    },
    {
      label: "Smallest script",
      value: fewestBytes === null ? "—" : formatNumber(fewestBytes.bytes),
      ...(fewestBytes === null
        ? {}
        : {
            hint: `bytes, at ${formatNumber(fewestBytes.opcodes)} opcodes and ${formatWork(fewestBytes.workBits)} work`,
          }),
    },
    {
      label: "Fewest opcodes",
      value: fewestOpcodes === null ? "—" : formatNumber(fewestOpcodes.opcodes),
      ...(fewestOpcodes === null
        ? {}
        : { hint: `of 201, at ${formatNumber(fewestOpcodes.bytes)} bytes` }),
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
                {track.provisional ? <Badge>Starting board · not yet recorded</Badge> : null}
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
