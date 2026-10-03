import { Button } from "@autoresearch/ui/components/button"
import { Carousel } from "@autoresearch/ui/components/carousel"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { ArrowUpRight, Plus } from "lucide-react"

import type { Challenge, Scorecard } from "@/data/schema"
import { formatScore, formatSeconds } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { CairoProgress, CandidateHighlight } from "@/lib/candidates"
import { summarize } from "@/lib/scoring"

import { StatusBadge } from "../challenge/status-badge"
import { SectionLink } from "../site/section-link"
import { Sparkline } from "./sparkline"

export interface ShowcaseEntry {
  challenge: Challenge
  scorecards: readonly Scorecard[]
  highlight: CandidateHighlight | null
  progress: CairoProgress | null
}

/** The figure a card leads with: proof time removed, from the strongest evidence available. */
function improvement({ progress, highlight }: ShowcaseEntry): { value: number; label: string } {
  if (progress)
    return {
      value: progress.reduction * 100,
      label: `less Cairo proof time since ${progress.since}`,
    }
  if (highlight)
    return {
      value: (1 - 1 / (1 + highlight.fullBasketGain)) * 100,
      label: `less proof time across every job · PR #${String(highlight.candidate.prNumber)}`,
    }
  return { value: 0, label: "improvement so far · the baseline holds" }
}

function ChallengeCard(entry: ShowcaseEntry) {
  const { challenge, scorecards, highlight } = entry
  const lead = improvement(entry)
  const summary = summarize(challenge, scorecards)
  const ranked = summary.ranked > 0
  const cairoTimes = challenge.cases.flatMap((testCase) =>
    testCase.family === "pie" && testCase.baseline.proofTimeS !== null
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
          label: "Fastest direct Cairo proof",
          value: cairoTimes.length === 0 ? "Pending" : formatSeconds(Math.min(...cairoTimes)),
        },
        { label: "Ranked", value: "0" },
      ]
  // Cairo proofs when this host has them, otherwise whichever jobs it has proved so far.
  const proved = challenge.cases.flatMap((testCase) =>
    testCase.baseline.proofTimeS === null
      ? []
      : [
          {
            id: testCase.id,
            family: testCase.family,
            title: testCase.title,
            seconds: testCase.baseline.proofTimeS,
          },
        ],
  )
  const cairoOnly = proved.some((testCase) => testCase.family === "pie")
  const bars = cairoOnly ? proved.filter((testCase) => testCase.family === "pie") : proved
  const slowest = Math.max(...bars.map((testCase) => testCase.seconds))
  return (
    <Spotlight className="group/card h-full">
      <SectionLink
        href={routes.challenge(challenge.slug)}
        className="grid h-full gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]"
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={challenge.status} />
            <span className="font-mono text-xs text-fg-faint">/{challenge.slug}</span>
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="text-[clamp(3.5rem,8vw,6.5rem)] leading-[0.85] font-light tracking-[-0.06em] text-accent tabular">
              <NumberTicker value={lead.value} suffix="%" />
            </p>
            <p className="max-w-[16rem] pb-1 text-sm leading-snug text-fg-muted">{lead.label}</p>
          </div>
          <div>
            <h3 className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl">
              {challenge.name}
            </h3>
            <p className="mt-4 max-w-md text-fg-muted">{challenge.summary}</p>
            {highlight ? (
              <p className="mt-5 max-w-md border-l-2 border-accent pl-4 text-sm text-fg-muted">
                <span className="text-accent">
                  PR #{highlight.candidate.prNumber} · direct {challenge.contract.hardware.gpu}{" "}
                  research:
                </span>{" "}
                all {highlight.pieCount} public PIEs cut proof time by{" "}
                {Math.round(highlight.pieReductionMin * 100)}–
                {Math.round(highlight.pieReductionMax * 100)}%. Unranked.
              </p>
            ) : null}
          </div>
          <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-label">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-light tracking-tight tabular">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-bg p-5">
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
                className="h-40 w-full"
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 text-label">
                <span>
                  {cairoOnly ? "Direct Cairo proof stage" : "Direct proof stage"} ·{" "}
                  {challenge.contract.hardware.gpu}
                </span>
                <span className="text-fg-muted">baseline</span>
              </div>
              {bars.length === 0 ? (
                <p className="text-sm text-fg-faint">No proof jobs measured on this host yet.</p>
              ) : null}
              <ul className="space-y-2.5">
                {bars.map((testCase) => (
                  <li
                    key={testCase.id}
                    className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-xs"
                  >
                    <span className="truncate text-fg-muted">{testCase.title}</span>
                    <span aria-hidden className="relative h-1.5 rounded-full bg-surface">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-accent"
                        style={{ width: `${String((testCase.seconds / slowest) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right font-mono text-fg tabular">
                      {formatSeconds(testCase.seconds)}
                    </span>
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
  proposeUrl,
}: {
  entries: readonly ShowcaseEntry[]
  proposeUrl: string
}) {
  return (
    <Section id="challenges">
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
              Each challenge pins one workload, one rig and one score. Leaderboards update as
              results are re-proved.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-14">
          <Carousel
            label="Challenges"
            slides={[
              ...entries.map((entry) => ({
                id: entry.challenge.slug,
                content: <ChallengeCard {...entry} />,
              })),
              {
                id: "next-race",
                content: (
                  <div className="flex h-full flex-col justify-between gap-10 rounded-2xl border border-dashed border-line p-6 sm:p-10">
                    <span className="inline-flex size-12 items-center justify-center rounded-full border border-line text-fg-faint">
                      <Plus className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-normal tracking-tight">Next race</h3>
                      <p className="mt-3 text-fg-muted">
                        Have a proving bottleneck with a clean, verifiable score? Propose it as the
                        next challenge.
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
    </Section>
  )
}
