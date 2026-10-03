import { Button } from "@autoresearch/ui/components/button"
import { Formula } from "@autoresearch/ui/components/formula"
import { Container } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Magnetic } from "@autoresearch/ui/motion/magnetic"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import type { Challenge, Site } from "@/data/schema"
import { routes } from "@/lib/routes"
import type { Summary } from "@/lib/scoring"
import type { CairoProgress, CandidateHighlight } from "@/lib/candidates"

import { SectionLink } from "../site/section-link"
import { WarpField } from "./warp-field"

export function Hero({
  site,
  challenges,
  featured,
  summary,
  highlight,
  progress,
  candidates,
}: {
  site: Site
  challenges: readonly Challenge[]
  featured: Challenge
  summary: Summary
  highlight: CandidateHighlight | null
  progress: CairoProgress | null
  candidates: number
}) {
  const ranked = summary.ranked > 0
  const primary = featured.tracks[0]
  const gpu = featured.contract.hardware.gpu
  const backends = challenges.map((challenge) => challenge.backend.toUpperCase()).join(" · ")
  // Real numbers only: ranked leaders once the judge is live; otherwise the Cairo proof time
  // removed since the first recorded prover, then the latest reviewed candidate.
  const lead = ranked
    ? {
        value: summary.leaders[primary?.id ?? "latency"]?.score ?? 1,
        digits: 2,
        suffix: "×",
        blurb: `faster proof execution across Cairo proofs, wraps and folds on ${featured.name}, ranked against the pinned baseline on ${gpu}.`,
      }
    : progress
      ? {
          value: progress.reduction * 100,
          digits: 0,
          suffix: "%",
          blurb: `less Cairo proof time on ${featured.name} since ${progress.since}, the first recorded prover: ${formatNumber(progress.speedup, 1)}× faster on ${gpu}. Unranked research.`,
        }
      : highlight
        ? {
            value: highlight.fullBasketGain * 100,
            digits: 1,
            suffix: "%",
            blurb: `faster proof execution across every ${featured.name} job for PR #${String(highlight.candidate.prNumber)}. Unranked research.`,
          }
        : null
  const figures = [
    { label: "Challenges", value: formatNumber(challenges.length), hint: backends },
    progress
      ? {
          label: "Cairo proofs",
          value: `${formatNumber(progress.speedup, 1)}×`,
          hint: `faster since ${progress.since}`,
        }
      : {
          label: "Public jobs",
          value: formatNumber(featured.cases.length),
          hint: "shared across backends",
        },
    ranked
      ? { label: "Ranked", value: formatNumber(summary.ranked), hint: "scorecards" }
      : { label: "Reviewed candidates", value: formatNumber(candidates), hint: "open PRs" },
  ]

  return (
    <section className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden pt-32 pb-10">
      <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_72%_38%,black,transparent_70%)]">
        <WarpField />
      </div>

      <Container>
        <Reveal y={12}>
          <p className="text-label">{site.tagline}</p>
        </Reveal>

        <h1 className="mt-8 text-[clamp(2.5rem,10vw,9.5rem)] leading-[0.9] font-normal tracking-[-0.055em] whitespace-nowrap">
          <SplitText text="autoresearch" />
          <SplitText
            text=".fun"
            delay={0.18}
            wordClassName="font-display font-normal italic text-accent pr-[0.06em]"
          />
        </h1>
        <Reveal delay={0.35}>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-fg-muted">{site.summary}</p>
        </Reveal>

        <div className="mt-14 grid gap-12 border-t border-line pt-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <Reveal delay={0.5}>
            {lead === null ? (
              <div />
            ) : (
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <p className="text-[clamp(3rem,6.5vw,5.75rem)] leading-[0.85] font-light tracking-[-0.06em] tabular">
                  <NumberTicker
                    value={lead.value}
                    fractionDigits={lead.digits}
                    suffix={lead.suffix}
                    delay={0.6}
                  />
                </p>
                <p className="max-w-xs pb-1 leading-relaxed text-fg-muted">{lead.blurb}</p>
              </div>
            )}
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
                <SectionLink href={routes.homeSection("challenges")}>
                  See the challenges
                  <ArrowUpRight className="transition-transform duration-500 ease-out-expo group-hover/button:rotate-45" />
                </SectionLink>
              </Button>
            </Magnetic>
            <Magnetic>
              <Button asChild size="lg" variant="ghost">
                <SectionLink href={routes.challengeSection(featured.slug, "leaderboard")}>
                  {featured.name} leaderboard
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
