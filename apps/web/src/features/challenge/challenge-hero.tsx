import { Badge } from "@autoresearch/ui/components/badge"
import { Container } from "@autoresearch/ui/components/layout"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import type { Challenge, ResearchCase, ResearchReview } from "@/data/schema"
import { summarizeBaseline } from "@/lib/baseline"
import { routes } from "@/lib/routes"
import type { Summary } from "@/lib/scoring"

import { ProgressChart } from "../chart/progress-chart"
import { RecordCards } from "../records/record-cards"
import { ResearchComparisonChart } from "../research/research-comparison-chart"
import { ResearchProgressChart } from "../research/research-progress-chart"
import { SectionLink } from "../site/section-link"
import { StageStrip } from "../workload/proof-pipeline"
import { StatusBadge } from "./status-badge"

/**
 * Challenge route hero: the leaderboard chart framed by title and stats. It is anchored on the
 * direct H200 reference data, so it reads correctly before the first ranked scorecard exists.
 */
export function ChallengeHero({
  challenge,
  summary,
  reviews,
  measurements,
}: {
  challenge: Challenge
  summary: Summary
  reviews: readonly ResearchReview[]
  measurements: readonly ResearchCase[]
}) {
  const ranked = summary.ranked > 0
  const { baseline } = summarizeBaseline(challenge)
  const gatesDone = challenge.gates.filter((gate) => gate.status === "done").length
  // Ranked: live track leaders. Before that: the direct H200 reference data, never a placeholder.
  const stats: { label: string; value: ReactNode }[] = ranked
    ? [
        ...challenge.tracks.map((track) => ({
          label: `${track.name} leader`,
          value: (
            <NumberTicker
              value={summary.leaders[track.id]?.score ?? 1}
              fractionDigits={3}
              suffix="×"
              delay={0.4}
            />
          ),
        })),
        {
          label: "Ranked scorecards",
          value: <NumberTicker value={summary.ranked} delay={0.4} />,
        },
      ]
    : [
        { label: "Direct Cairo proof stage", value: baseline.cairoRange },
        { label: "Direct device peak", value: baseline.peakRange },
        { label: "Ranked submissions", value: "0" },
        {
          label: "Activation",
          value: `${String(gatesDone)} / ${String(challenge.gates.length)} gates`,
        },
      ]
  return (
    <section id="overview" className="relative scroll-mt-24 pt-24 pb-8 sm:pt-28">
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

        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
          <div>
            <Reveal y={8} delay={0.05}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={challenge.status} />
                <Badge>1× {challenge.contract.hardware.gpu}</Badge>
                <Badge>{challenge.contract.epoch}</Badge>
              </div>
            </Reveal>
            <h1 className="mt-5 text-[clamp(2.75rem,6vw,5.75rem)] leading-[0.92] font-normal tracking-[-0.05em]">
              <SplitText text={challenge.name} />
            </h1>
          </div>
          {/* Leader stats sit beside the title so the chart starts higher on the page. */}
          <Reveal delay={0.3}>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 pb-2 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="border-l border-line pl-4">
                  <dt className="text-label whitespace-nowrap">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-light tracking-tight whitespace-nowrap tabular sm:text-3xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <Reveal delay={0.35} className="mt-10">
          <ResearchProgressChart
            challenge={challenge}
            reviews={reviews}
            measurements={measurements}
          />
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-8 max-w-4xl leading-relaxed text-fg-muted">{challenge.summary}</p>
          <div className="mt-5">
            <StageStrip challenge={challenge} />
          </div>
        </Reveal>
        <Reveal delay={0.5} className="mt-6">
          {reviews.some((review) =>
            measurements.some(
              (row) => row.prNumber === review.prNumber && row.headSha === review.headSha,
            ),
          ) ? (
            <ResearchComparisonChart
              challenge={challenge}
              reviews={reviews}
              measurements={measurements}
            />
          ) : null}
          {ranked ? (
            <ProgressChart
              scored={summary.scored}
              minImprovement={challenge.contract.minImprovement}
              baselineDate={challenge.contract.baselineMeasuredAt}
            />
          ) : null}
        </Reveal>
        <div className="mt-4">
          <RecordCards challenge={challenge} summary={summary} />
        </div>
        <p className="mt-6 text-label">
          Scores are relative to the pinned baseline (1.000×), higher is better.{" "}
          {ranked
            ? "Every entry is a judge-signed rank receipt."
            : `Direct reference: stwo-zig ${challenge.contract.sourceCommit.slice(0, 8)}, measured ${baseline.measured} on ${challenge.contract.hardware.gpu} (${String(baseline.rounds)} unranked direct runs). Ranking opens when the H200 judge is activated, ${String(gatesDone)} of ${String(challenge.gates.length)} gates done.`}
        </p>
      </Container>
    </section>
  )
}
