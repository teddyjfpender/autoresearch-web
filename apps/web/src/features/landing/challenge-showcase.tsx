import { Button } from "@autoresearch/ui/components/button"
import { Carousel } from "@autoresearch/ui/components/carousel"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { ArrowUpRight, Plus } from "lucide-react"

import type { CircuitChallenge } from "@/data/circuit/schema"
import type { Challenge, Scorecard } from "@/data/schema"
import { formatScore, formatSeconds } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { CairoProgress, CandidateHighlight, ProofTimeLead } from "@/lib/candidates"
import { summarize } from "@/lib/scoring"

import { StatusBadge } from "../challenge/status-badge"
import { CircuitCard } from "./circuit-card"
import { LeadFigure, LeadModeProvider, LeadModeSwitch, type LeadFigureProps } from "./lead-figure"
import { SectionLink } from "../site/section-link"
import { Sparkline } from "./sparkline"

const formatCycles = (cycles: number) =>
  cycles >= 1e6 ? `${formatNumber(cycles / 1e6, 2)}M` : `${formatNumber(cycles / 1e3, 0)}K`

export interface ShowcaseEntry {
  challenge: Challenge
  scorecards: readonly Scorecard[]
  highlight: CandidateHighlight | null
  progress: CairoProgress | null
  proofTime: ProofTimeLead | null
}

/** The figure a card leads with: proof time removed, from the strongest evidence available. */
function improvement({ challenge, progress, highlight }: ShowcaseEntry): {
  value: number
  label: string
} {
  if (progress)
    return {
      value: progress.reduction * 100,
      label: `less ${challenge.focus.label} time since ${progress.since}`,
    }
  if (highlight)
    return {
      value: (1 - 1 / (1 + highlight.fullBasketGain)) * 100,
      label: `less proof time across every job · PR #${String(highlight.candidate.prNumber)}`,
    }
  return { value: 0, label: "improvement so far · the baseline holds" }
}

const formatPerJob = (seconds: number) =>
  seconds < 1 ? `${formatNumber(seconds * 1000, 0)} ms` : formatSeconds(seconds)

/** The card's proof-time figure: per-job proof time across every job, or why it's missing. */
function timeLead({ proofTime }: ShowcaseEntry): LeadFigureProps["time"] {
  if (proofTime === null) return { seconds: null, label: "no baseline proof time published yet" }
  const jobs = `per job across all ${String(proofTime.jobs)} jobs`
  return proofTime.prNumber === null
    ? { seconds: proofTime.seconds, label: `${jobs} · baseline on this host` }
    : {
        seconds: proofTime.seconds,
        label: `${jobs} · PR #${String(proofTime.prNumber)}, was ${formatPerJob(proofTime.baselineS)}`,
      }
}

function ChallengeCard(entry: ShowcaseEntry) {
  const { challenge, scorecards } = entry
  const lead = improvement(entry)
  const summary = summarize(challenge, scorecards)
  const ranked = summary.ranked > 0
  const { focus } = challenge
  const cairoTimes = challenge.cases.flatMap((testCase) =>
    testCase.family === focus.family && testCase.baseline.proofTimeS !== null
      ? [testCase.baseline.proofTimeS]
      : [],
  )
  // Real numbers only: track leaders once ranked, measured facts before that.
  const stats = ranked
    ? challenge.tracks.map((track) => ({
        label: track.name,
        value: formatScore(summary.leaders[track.id]?.score ?? 1),
      }))
    : [
        { label: "Public cases", value: formatNumber(challenge.cases.length) },
        {
          label: `Fastest ${focus.label}`,
          value: cairoTimes.length === 0 ? "Pending" : formatSeconds(Math.min(...cairoTimes)),
        },
        { label: "Ranked", value: "0" },
      ]
  // The focus family's baseline when this host has it, else whichever jobs it has proved, else
  // (before any baseline) the pinned workload itself: guest cycles per target.
  const proved = challenge.cases.flatMap((testCase) =>
    testCase.baseline.proofTimeS === null
      ? []
      : [
          {
            id: testCase.id,
            family: testCase.family,
            label: testCase.title,
            value: testCase.baseline.proofTimeS,
            display: formatSeconds(testCase.baseline.proofTimeS),
          },
        ],
  )
  const focused = proved.filter((testCase) => testCase.family === focus.family)
  const cycles = challenge.families.flatMap((family) => {
    const counts = challenge.cases.flatMap((testCase) =>
      testCase.family === family.id && testCase.cycles !== undefined ? [testCase.cycles] : [],
    )
    if (counts.length === 0) return []
    const most = Math.max(...counts)
    return [{ id: family.id, label: family.name, value: most, display: formatCycles(most) }]
  })
  const panel =
    focused.length > 0
      ? { title: `Direct ${focus.label} baseline`, rows: focused }
      : proved.length > 0
        ? { title: "Direct proof baseline", rows: proved }
        : { title: "Guest cycles · largest input", rows: cycles }
  const bars = panel.rows
  const slowest = Math.max(...bars.map((row) => row.value))
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
          <LeadFigure improvement={lead} time={timeLead(entry)} />
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
                <dd className="mt-1 text-xl font-light tracking-tight tabular">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl bg-bg p-4 sm:p-5">
          {ranked ? (
            <>
              <div className="flex items-center justify-between text-label">
                <span>{challenge.tracks[0]?.name ?? ""} leader</span>
                <span className="text-fg-muted">
                  {formatScore(summary.leaders[challenge.tracks[0]?.id ?? "latency"]?.score ?? 1)}
                </span>
              </div>
              <Sparkline
                step
                values={[
                  1,
                  ...summary.promotions[challenge.tracks[0]?.id ?? "latency"]
                    .toReversed()
                    .map((p) => p.score),
                ]}
                className="h-28 w-full"
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 text-label">
                <span>
                  {panel.title} · {challenge.contract.hardware.gpu}
                </span>
                <span className="text-fg-muted">{proved.length > 0 ? "baseline" : "pinned"}</span>
              </div>
              {bars.length === 0 ? (
                <p className="text-sm text-fg-faint">No proof jobs measured on this host yet.</p>
              ) : null}
              <ul className="space-y-2">
                {bars.map((row) => (
                  <li
                    key={row.id}
                    className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-xs"
                  >
                    <span className="truncate text-fg-muted">{row.label}</span>
                    <span aria-hidden className="relative h-1.5 rounded-full bg-surface">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-accent"
                        style={{ width: `${String((row.value / slowest) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right font-mono text-fg tabular">{row.display}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
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

export function ChallengeShowcase({
  entries,
  circuits,
  proposeUrl,
}: {
  entries: readonly ShowcaseEntry[]
  /** Circuit-challenge tracks, shown after the proving races. */
  circuits: readonly CircuitChallenge[]
  proposeUrl: string
}) {
  return (
    <Section id="challenges">
      <LeadModeProvider>
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Reveal>
                <Eyebrow index="01">Challenges</Eyebrow>
              </Reveal>
              <Reveal delay={0.1}>
                <Heading className="mt-6 max-w-[14ch]">
                  Pick a race. <em className="font-display font-normal">Move</em> the frontier.
                </Heading>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <p className="max-w-md text-fg-muted">
                Each challenge pins one workload, one judge and one score. Leaderboards update as
                results are re-verified.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-14 flex justify-end">
            <LeadModeSwitch />
          </Reveal>
          <Reveal delay={0.1} className="mt-4">
            <Carousel
              label="Challenges"
              slides={[
                ...entries.map((entry) => ({
                  id: entry.challenge.slug,
                  content: <ChallengeCard {...entry} />,
                })),
                ...circuits.map((challenge) => ({
                  id: challenge.slug,
                  content: <CircuitCard challenge={challenge} />,
                })),
                {
                  id: "next-race",
                  content: (
                    <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-dashed border-line p-5 sm:p-7">
                      <span className="inline-flex size-12 items-center justify-center rounded-full border border-line text-fg-faint">
                        <Plus className="size-5" />
                      </span>
                      <div>
                        <h3 className="text-2xl font-normal tracking-tight">Next race</h3>
                        <p className="mt-3 text-fg-muted">
                          Have a hard problem with a clean, verifiable score? Propose it as the next
                          challenge.
                        </p>
                      </div>
                      <Button asChild variant="outline" className="self-start">
                        <a href={proposeUrl} target="_blank" rel="noreferrer">
                          Propose a challenge
                          <ArrowUpRight />
                        </a>
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </Reveal>
        </Container>
      </LeadModeProvider>
    </Section>
  )
}
