import { Formula } from "@autoresearch/ui/components/formula"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"

import type { Challenge } from "@/data/schema"
import { formatGB } from "@/lib/format"

import { SpecList } from "../how/steps-section"

/** Track formulas and guards, the aggregation rule, promotion and the fixed security profile. */
export function ScoringSection({ challenge }: { challenge: Challenge }) {
  const { contract } = challenge
  return (
    <Section id="scoring" className="border-t border-line">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow index="05">How the score works</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6 max-w-[18ch]">
                Correctness first. <em className="font-display font-normal">Then</em> the clock.
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-md text-fg-muted">
              Any failed case removes a submission from every track. Higher is better and the pinned
              baseline scores exactly 1. Missing one track&apos;s guard only removes that track.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {challenge.tracks.map((track, index) => (
            <Reveal key={track.id} delay={index * 0.06} className="h-full">
              <article className="flex h-full flex-col gap-6 bg-bg p-6 sm:p-8">
                <div>
                  <h3 className="text-2xl font-normal tracking-tight">{track.name}</h3>
                  <p className="mt-2 text-sm text-fg-muted">{track.objective}</p>
                </div>
                <p className="text-2xl font-light tracking-tight">
                  <Formula>{track.formula}</Formula>
                </p>
                <ul className="space-y-1.5">
                  {track.guards.map((guard) => (
                    <li key={guard} className="text-sm text-fg-muted">
                      <Formula>{guard}</Formula>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto text-sm text-fg-faint">{track.why}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-8">
              <div>
                <p className="text-label">Aggregation</p>
                <p className="mt-4 text-lg leading-relaxed font-light">
                  <Formula>R_T = exp(Σᵢ wᵢ · ln(Tᵢ / T₀ᵢ))</Formula>{" "}
                  <span className="text-sm text-fg-faint">command time</span>
                  <br />
                  <Formula>R_M = exp(Σᵢ wᵢ · ln(Mᵢ / M₀ᵢ))</Formula>{" "}
                  <span className="text-sm text-fg-faint">device peak</span>
                </p>
                <p className="mt-4 text-sm text-fg-muted">
                  {contract.timeScope} {contract.memoryScope} <Formula>R_T</Formula> and{" "}
                  <Formula>R_M</Formula> are the weighted geometric means of those per-case ratios
                  against the baseline, measured in paired rounds on the same host: 1.00 is the
                  baseline, below 1 is better.
                </p>
              </div>
              <div>
                <p className="text-label">Promotion</p>
                <p className="mt-4 text-sm text-fg-muted">
                  A new leader has to beat the current one by at least{" "}
                  {formatNumber(contract.minImprovement * 100)}% and clear twice the paired A/A
                  noise. The lower bound of a {formatNumber(contract.bootstrapResamples)}-resample
                  bootstrap over at least {String(contract.pairedRounds)} ABBA rounds must clear
                  that bar.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SpecList
              specs={[
                { label: "Hardware", value: `1× ${contract.hardware.gpu}, exclusive` },
                { label: "Device memory", value: formatGB(contract.hardware.deviceBytes, 2) },
                {
                  label: "Reserve",
                  value: `${formatGB(contract.hardware.reserveBytes, 0)} beyond the plan`,
                },
                { label: "FRI queries", value: String(contract.security.friQueries) },
                {
                  label: "PoW bits",
                  value: `${String(contract.security.queryPowBits)} query · ${String(contract.security.interactionPowBits)} interaction`,
                },
                { label: "Preprocessing", value: contract.security.preprocessedVariant },
                {
                  label: "Epoch",
                  value: contract.draft ? `${contract.epoch} (draft)` : contract.epoch,
                },
              ]}
            />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
