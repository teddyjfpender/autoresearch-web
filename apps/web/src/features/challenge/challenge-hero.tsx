import { Badge } from "@autoresearch/ui/components/badge"
import { Formula } from "@autoresearch/ui/components/formula"
import { Container } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ChevronRight } from "lucide-react"

import type { Challenge } from "@/data/schema"
import { formatSeconds } from "@/lib/format"
import { scoreFor, type Candidate, type FirstProof } from "@/lib/candidates"
import { routes } from "@/lib/routes"
import type { Summary } from "@/lib/scoring"

import { SectionLink } from "../site/section-link"
import { BackendSwitcher } from "./backend-switcher"
import { StatusBadge } from "./status-badge"

/**
 * Compact challenge header: identity, one line of context, and four computed figures. The
 * chart and leaderboard follow directly below in the board.
 */
export function ChallengeHero({
  challenge,
  summary,
  candidates,
  firstProof,
}: {
  challenge: Challenge
  summary: Summary
  candidates: readonly Candidate[]
  firstProof: FirstProof | null
}) {
  const gatesDone = challenge.gates.filter((gate) => gate.status === "done").length
  const seconds = (values: readonly number[]) =>
    values.length === 0
      ? "—"
      : `${formatNumber(Math.min(...values), 2)}–${formatSeconds(Math.max(...values))}`
  const best = (bucket: "basket" | "pie") =>
    candidates
      .filter((candidate) => candidate.buckets[bucket] !== null)
      .toSorted(
        (a, b) => (scoreFor(b, "latency", bucket) ?? 0) - (scoreFor(a, "latency", bucket) ?? 0),
      )[0]
  const basketLeader = best("basket")
  const cairoLeader = best("pie")
  const cairoCases = cairoLeader?.cases.filter((item) => item.family === "pie") ?? []
  const baselineCairo = challenge.cases.flatMap((testCase) =>
    testCase.family === "pie" && testCase.baseline.proofTimeS !== null
      ? [testCase.baseline.proofTimeS]
      : [],
  )
  // The leader's Cairo proof times expressed against the challenge baseline (the first
  // measured proof of each job): baseline × the leader's paired proof-time ratio.
  const cairoAgainstBaseline = cairoCases.flatMap((item) => {
    const first = challenge.cases.find((testCase) => testCase.id === item.caseId)?.baseline
      .proofTimeS
    return first === null || first === undefined
      ? []
      : [
          {
            candidate: first * (item.candidateS / item.baselineS),
            // Where the job started: its first recorded proof, else the challenge baseline.
            was: firstProof?.seconds.get(item.caseId) ?? first,
          },
        ]
  })
  const wasLabel = firstProof === null ? "at baseline" : `at ${firstProof.milestone}`
  const proved = challenge.cases.filter((testCase) => testCase.baseline.rounds > 0).length
  const speedup = (candidate: Candidate | undefined, bucket: "basket" | "pie") =>
    candidate === undefined
      ? "—"
      : `${formatNumber(scoreFor(candidate, "latency", bucket) ?? 1, 3)}×`

  // Every figure is proof execution time: the scored clock of this epoch.
  const stats: { label: string; value: string; hint?: string }[] =
    summary.ranked > 0
      ? [
          ...challenge.tracks.map((track) => ({
            label: `${track.name} leader`,
            value: `${formatNumber(summary.leaders[track.id]?.score ?? 1, 3)}×`,
          })),
          { label: "Ranked", value: formatNumber(summary.ranked) },
        ]
      : candidates.length > 0
        ? [
            {
              label: "Best proof-time speedup",
              value: speedup(basketLeader, "basket"),
              hint:
                basketLeader === undefined
                  ? "no complete proof basket yet"
                  : `PR #${String(basketLeader.prNumber)} · all jobs`,
            },
            {
              label: "Best Cairo proof speedup",
              value: speedup(cairoLeader, "pie"),
              ...(cairoLeader
                ? { hint: `PR #${String(cairoLeader.prNumber)} · Cairo proofs` }
                : {}),
            },
            cairoAgainstBaseline.length > 0
              ? {
                  label: "Cairo proof time",
                  value: seconds(cairoAgainstBaseline.map((item) => item.candidate)),
                  hint: `was ${seconds(cairoAgainstBaseline.map((item) => item.was))} ${wasLabel}`,
                }
              : { label: "Cairo proof time", value: seconds(baselineCairo), hint: "baseline" },
            {
              label: "Activation",
              value: `${String(gatesDone)} / ${String(challenge.gates.length)}`,
              hint: `${formatNumber(candidates.length)} reviewed candidates`,
            },
          ]
        : [
            {
              label: "Jobs proved here",
              value: `${String(proved)} / ${String(challenge.cases.length)}`,
              hint: challenge.contract.hardware.gpu,
            },
            {
              label: "Cairo proof time",
              value: seconds(baselineCairo),
              hint:
                baselineCairo.length === 0
                  ? "not yet proved on this host"
                  : "baseline on this host",
            },
            { label: "Reviewed candidates", value: "0", hint: "open a PR to appear here" },
            {
              label: "Activation",
              value: `${String(gatesDone)} / ${String(challenge.gates.length)}`,
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
                <Badge>1× {challenge.contract.hardware.gpu}</Badge>
                <Badge>
                  {challenge.contract.draft
                    ? `${challenge.contract.epoch} · staging`
                    : challenge.contract.epoch}
                </Badge>
                <BackendSwitcher challenge={challenge} />
              </div>
            </Reveal>
            <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-normal tracking-[-0.05em]">
              <SplitText text={challenge.name} />
            </h1>
            <Reveal delay={0.2}>
              <p className="mt-4 leading-relaxed text-fg-muted">{challenge.summary}</p>
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
                    <dd className="mt-0.5 text-xs whitespace-nowrap text-fg-faint">
                      <Formula>{stat.hint}</Formula>
                    </dd>
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
