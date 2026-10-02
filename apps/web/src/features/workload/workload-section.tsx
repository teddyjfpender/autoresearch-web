import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { Reveal } from "@autoresearch/ui/motion/reveal"

import type { Case, Challenge } from "@/data/schema"
import { formatGB, formatSeconds } from "@/lib/format"
import { caseWeights } from "@/lib/scoring"

import { MemoryBar } from "./memory-bar"
import { ProofPipeline } from "./proof-pipeline"

function caseMeta(testCase: Case): string {
  const parts: string[] = []
  if (testCase.blocks) {
    const [from, to] = testCase.blocks
    parts.push(
      from === to
        ? `Block ${formatNumber(from)}`
        : `Blocks ${formatNumber(from)}–${formatNumber(to)}`,
    )
  }
  if (testCase.osSteps !== undefined)
    parts.push(`${formatNumber(testCase.osSteps / 1e6, 1)}M steps`)
  if (testCase.leaves !== undefined) parts.push(`${String(testCase.leaves)} leaves`)
  if (testCase.mode !== undefined)
    parts.push(testCase.mode === "serial" ? "serial" : "resident batch")
  return parts.join(" · ")
}

/**
 * Where proving sits inside the whole command: a diagnostic proof-stage fraction of scored command time. Missing proof timers do not
 * prevent whole-command scoring.
 */
function ProofShare({ testCase }: { testCase: Case }) {
  const { proofTimeS, commandTimeS, ingressS, peakBytes, proofTimeScope } = testCase.baseline
  const share = proofTimeS === null ? null : proofTimeS / commandTimeS
  return (
    <div className="space-y-1.5">
      <div className="relative h-1 overflow-hidden rounded-full bg-surface" aria-hidden>
        {share === null ? (
          <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--ar-line-strong)_0_2px,transparent_2px_5px)]" />
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${String(share * 100)}%` }}
          />
        )}
      </div>
      <p className="text-label">
        {share === null
          ? proofTimeScope
          : `Proving is ${formatNumber(share * 100)}% of the ${formatSeconds(commandTimeS)} command`}
        {ingressS === undefined ? "" : ` · ingress ${formatSeconds(ingressS)} included`}
        {` · device peak ${formatGB(peakBytes)}`}
      </p>
    </div>
  )
}

/** The hash-pinned basket with direct proof timers and separate command diagnostics. */
export function WorkloadSection({ challenge }: { challenge: Challenge }) {
  const weights = caseWeights(challenge.cases)
  const { deviceBytes, reserveBytes } = challenge.contract.hardware
  return (
    <Section id="workload" className="border-t border-line">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow index="04">Workload</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6 max-w-[16ch]">
                Three proof kinds. <em className="font-display font-normal">Ten</em> cases.
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-md text-fg-muted">
              Every case is built from the same three proof kinds: Cairo proofs, wraps and folds.
              The research target is GPU proving. Cairo proof timers are retained; wrap and fold
              proof-only timers are not yet complete. The implemented h200-v1 judge clocks full
              commands, so proof-only ranking remains a launch gate.
            </p>
          </Reveal>
        </div>

        <ProofPipeline challenge={challenge} />

        <div className="mt-20 space-y-14">
          {challenge.families.map((family, familyIndex) => {
            const cases = challenge.cases.filter((testCase) => testCase.family === family.id)
            return (
              <Reveal key={family.id} delay={familyIndex * 0.05}>
                <section aria-labelledby={`family-${family.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-4">
                    <div className="flex items-baseline gap-4">
                      <h3
                        id={`family-${family.id}`}
                        className="text-2xl font-normal tracking-tight"
                      >
                        {family.name}
                      </h3>
                      <span className="text-label">
                        ⅓ weight · {cases.length} {cases.length === 1 ? "case" : "cases"}
                      </span>
                    </div>
                    <p className="max-w-lg text-sm text-fg-muted">{family.description}</p>
                  </div>
                  <ul className="divide-y divide-line">
                    {cases.map((testCase) => {
                      const { baseline } = testCase
                      return (
                        <li
                          key={testCase.id}
                          className="grid items-start gap-x-8 gap-y-4 py-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.3fr)]"
                        >
                          <div className="min-w-0">
                            <p className="flex items-baseline gap-3">
                              <span>{testCase.title}</span>
                              <span className="truncate font-mono text-xs text-fg-faint">
                                {testCase.id}
                              </span>
                            </p>
                            <p className="mt-1 text-sm text-fg-muted">{testCase.description}</p>
                            <p className="mt-1 text-label">{caseMeta(testCase)}</p>
                            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Proof stages">
                              {challenge.stages
                                .filter((stage) => testCase.stages.includes(stage.id))
                                .map((stage) => (
                                  <li
                                    key={stage.id}
                                    className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted"
                                  >
                                    {stage.name}
                                  </li>
                                ))}
                            </ul>
                          </div>
                          <div className="md:text-right">
                            <p className="text-2xl font-light tracking-tight tabular">
                              {baseline.proofTimeS === null
                                ? "Proof timer pending"
                                : formatSeconds(baseline.proofTimeS)}
                            </p>
                            <p className="text-label">
                              proof stage · w{" "}
                              {formatNumber((weights.get(testCase.id) ?? 0) * 100, 1)}%
                            </p>
                            <p className="text-label">
                              {formatSeconds(baseline.commandTimeS)} full command
                            </p>
                          </div>
                          <div className="space-y-3">
                            <MemoryBar
                              peakBytes={baseline.peakBytes}
                              deviceBytes={deviceBytes}
                              reserveBytes={reserveBytes}
                              label={`${formatGB(baseline.peakBytes)} device peak`}
                            />
                            <ProofShare testCase={testCase} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </Reveal>
            )
          })}
        </div>

        <p className="mt-10 text-label">
          These are medians of two unranked direct H200 runs. Cairo proof-stage times are 1.17–1.95
          s; the 6.90–9.78 s range includes ingress and publication. Fold and pipeline proof-only
          timers are unavailable. The implemented h200-v1 judge still scores full-command time;
          proof-only ranking must wait for a new contract and complete timers.
        </p>
      </Container>
    </Section>
  )
}
