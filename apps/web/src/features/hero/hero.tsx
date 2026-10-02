import { Button } from "@autoresearch/ui/components/button"
import { Formula } from "@autoresearch/ui/components/formula"
import { Container } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Magnetic } from "@autoresearch/ui/motion/magnetic"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import type { Challenge } from "@/data/schema"
import { formatScore } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { Summary } from "@/lib/scoring"

import { StatusBadge } from "../challenge/status-badge"
import { AgentPromptDialog } from "../participate/agent-prompt-dialog"
import { SectionLink } from "../site/section-link"
import { WarpField } from "./warp-field"

export function Hero({ challenge, summary }: { challenge: Challenge; summary: Summary }) {
  const ranked = summary.ranked > 0
  const score = (track: "latency" | "memory" | "balanced") => summary.leaders[track]?.score ?? 1
  const cairo = challenge.cases.flatMap((testCase) =>
    testCase.family === "pie" && testCase.baseline.proofTimeS !== null
      ? [testCase.baseline.proofTimeS]
      : [],
  )
  // Real numbers only: ranked leaders once the judge is live, unranked direct H200 runs before that.
  const headline = ranked ? score("latency") : Math.min(...cairo)
  const blurb = ranked
    ? "faster adapted-input-to-publication CUDA proving across Cairo proofs, wraps and folds, against the pinned baseline on one H200."
    : `unranked direct Cairo proof time on one H200: the fastest of ${String(cairo.length)} public cases on pinned stwo-zig. A proof-only ranking still needs wrap and fold timers and a new contract.`
  const figures = ranked
    ? [
        { label: "Memory leader", value: formatScore(score("memory")), hint: "1 / R_M" },
        {
          label: "Balanced leader",
          value: formatScore(score("balanced")),
          hint: "1 / √(R_T · R_M)",
        },
        { label: "Ranked", value: formatNumber(summary.ranked), hint: "scorecards" },
      ]
    : [
        {
          label: "Public cases",
          value: formatNumber(challenge.cases.length),
          hint: "hash-pinned basket",
        },
        {
          label: "Proof stages",
          value: formatNumber(challenge.stages.length),
          hint: "Cairo · wrap · fold",
        },
        { label: "Ranked", value: "0", hint: "opens after activation" },
      ]

  return (
    <section className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden pt-32 pb-10">
      <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_72%_38%,black,transparent_70%)]">
        <WarpField />
      </div>

      <Container>
        <Reveal y={12}>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={challenge.status} />
            <span className="text-label">
              {challenge.name} · {challenge.contract.epoch} · 1× {challenge.contract.hardware.gpu}
            </span>
          </div>
        </Reveal>

        <h1 className="mt-8 max-w-[14ch] text-[clamp(3.25rem,11vw,10.5rem)] leading-[0.88] font-normal tracking-[-0.055em]">
          <SplitText text="Make Stwo" className="block" />
          <span className="block">
            <SplitText
              text="fly"
              delay={0.18}
              wordClassName="font-display font-normal italic text-accent pr-[0.06em]"
            />{" "}
            <SplitText text="on GPUs." delay={0.26} />
          </span>
        </h1>

        <div className="mt-20 grid gap-12 border-t border-line pt-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <Reveal delay={0.5}>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <p className="text-[clamp(3rem,6.5vw,5.75rem)] leading-[0.85] font-light tracking-[-0.06em] tabular">
                <NumberTicker
                  value={headline}
                  fractionDigits={2}
                  suffix={ranked ? "×" : " s"}
                  delay={0.6}
                />
              </p>
              <p className="max-w-xs pb-1 leading-relaxed text-fg-muted">{blurb}</p>
            </div>
          </Reveal>

          <Reveal delay={0.65}>
            <dl className="grid grid-cols-3 gap-4">
              {figures.map((figure) => (
                <div key={figure.label} className="flex flex-col gap-1">
                  <dt className="text-label">{figure.label}</dt>
                  <dd className="text-2xl font-light tracking-tight tabular sm:text-3xl">
                    {figure.value}
                  </dd>
                  <dd className="text-xs text-fg-faint">
                    <Formula>{figure.hint}</Formula>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.8}>
          <div className="mt-12 flex flex-wrap items-center gap-2">
            <Magnetic>
              <Button asChild size="lg">
                <SectionLink href={routes.challenge(challenge.slug)}>
                  Enter the challenge
                  <ArrowUpRight className="transition-transform duration-500 ease-out-expo group-hover/button:rotate-45" />
                </SectionLink>
              </Button>
            </Magnetic>
            <AgentPromptDialog repositoryUrl={challenge.links.repo} size="lg" />
            <Magnetic>
              <Button asChild size="lg" variant="ghost">
                <SectionLink href={routes.challengeSection(challenge.slug, "leaderboard")}>
                  See the leaderboard
                  <ArrowRight className="transition-transform duration-500 ease-out-expo group-hover/button:translate-x-0.5" />
                </SectionLink>
              </Button>
            </Magnetic>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
