import { Button } from "@autoresearch/ui/components/button"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { ArrowUpRight, Plus } from "lucide-react"

import type { Challenge, Scorecard } from "@/data/schema"
import { formatScore, formatSeconds } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { ResearchHighlight } from "@/lib/research-summary"
import { summarize } from "@/lib/scoring"

import { StatusBadge } from "../challenge/status-badge"
import { SectionLink } from "../site/section-link"
import { Sparkline } from "./sparkline"

export interface ShowcaseEntry {
  challenge: Challenge
  scorecards: readonly Scorecard[]
  highlight: ResearchHighlight | null
}

function ChallengeCard({ challenge, scorecards, highlight }: ShowcaseEntry) {
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
        { label: "Fastest direct Cairo proof", value: formatSeconds(Math.min(...cairoTimes)) },
        { label: "Ranked", value: "0" },
      ]
  const cairoCases = challenge.cases.flatMap((testCase) =>
    testCase.family !== "pie" || testCase.baseline.proofTimeS === null
      ? []
      : [{ id: testCase.id, title: testCase.title, seconds: testCase.baseline.proofTimeS }],
  )
  const slowest = Math.max(...cairoCases.map((testCase) => testCase.seconds))
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
          <div>
            <h3 className="text-4xl font-normal tracking-[-0.04em] sm:text-5xl">
              {challenge.name}
            </h3>
            <p className="mt-4 max-w-md text-fg-muted">{challenge.summary}</p>
            {highlight ? (
              <p className="mt-5 max-w-md border-l-2 border-accent pl-4 text-sm text-fg-muted">
                <span className="text-accent">
                  PR #{highlight.review.prNumber} · direct H200 research:
                </span>{" "}
                all {highlight.pieCount} public PIEs cut full-command time by{" "}
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
                <span>Balanced leader</span>
                <span className="text-fg-muted">
                  {formatScore(summary.leaders.balanced?.score ?? 1)}
                </span>
              </div>
              <Sparkline
                step
                values={[1, ...summary.promotions.balanced.toReversed().map((p) => p.score)]}
                className="h-40 w-full"
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 text-label">
                <span>Direct Cairo proof stage · H200</span>
                <span className="text-fg-muted">unranked reference</span>
              </div>
              <ul className="space-y-2.5">
                {cairoCases.map((testCase) => (
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

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <Reveal key={entry.challenge.slug} delay={index * 0.08} className="lg:col-span-2">
              <ChallengeCard {...entry} />
            </Reveal>
          ))}
          <Reveal delay={0.12}>
            <div className="flex h-full flex-col justify-between gap-10 rounded-2xl border border-dashed border-line p-6 sm:p-10">
              <span className="inline-flex size-12 items-center justify-center rounded-full border border-line text-fg-faint">
                <Plus className="size-5" />
              </span>
              <div>
                <h3 className="text-2xl font-normal tracking-tight">Next race</h3>
                <p className="mt-3 text-fg-muted">
                  Have a proving bottleneck with a clean, verifiable score? Propose it as the next
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
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
