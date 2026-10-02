import { Badge } from "@autoresearch/ui/components/badge"
import { cn } from "@autoresearch/ui/lib/cn"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ArrowRight } from "lucide-react"

import type { Challenge, Stage } from "@/data/schema"

/** Command work that is included in the ranked wall clock. */
function CommandStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-4 text-fg-faint">
      <span className="text-label">Scored command work</span>
      <span className="text-sm text-fg-muted">{title}</span>
      <span className="text-xs">{body}</span>
    </div>
  )
}

function StageCard({ stage, index }: { stage: Stage; index: number }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-line-strong bg-bg-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-fg-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Badge size="sm" tone={stage.baselineTimed ? "accent" : "neutral"}>
          {stage.baselineTimed ? "Proof timer retained" : "Proof timer unavailable"}
        </Badge>
      </div>
      <h4 className="text-lg font-normal tracking-tight">{stage.name}</h4>
      <p className="text-sm text-fg-muted">{stage.summary}</p>
      <p className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-fg-faint">
        <span>{stage.input}</span>
        <ArrowRight className="size-3" aria-hidden />
        <span className="text-fg-muted">{stage.output}</span>
      </p>
    </div>
  )
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center text-fg-faint max-lg:rotate-90 max-lg:py-1"
    >
      <ArrowRight className="size-4" />
    </span>
  )
}

/**
 * The proof kinds and surrounding work included in the scored command, in pipeline order.
 */
export function ProofPipeline({ challenge }: { challenge: Challenge }) {
  const { stages, families, cases } = challenge
  return (
    <div className="mt-14 space-y-10">
      <Reveal>
        <figure aria-labelledby="pipeline-caption">
          <ol className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1.3fr_auto_1.3fr_auto_1.3fr_auto_1fr]">
            <li>
              <CommandStep
                title="Ingress & setup"
                body="Load adapted input, upload assets, set up."
              />
            </li>
            {stages.map((stage, index) => (
              <li key={stage.id} className="contents">
                <Arrow />
                <StageCard stage={stage} index={index} />
              </li>
            ))}
            <li className="contents">
              <Arrow />
              <CommandStep
                title="Publication"
                body="Decode and publish. Independent verification follows the clock."
              />
            </li>
          </ol>
          <figcaption id="pipeline-caption" className="mt-4 text-label">
            The scored clock spans adapted input through proof publication. Independent verification
            follows as a correctness gate. Folds repeat pairwise: eight leaves need seven folds.
          </figcaption>
        </figure>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Proof stages exercised by each case family</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="h-10 pr-4 text-left text-label font-normal">
                  Family
                </th>
                {stages.map((stage) => (
                  <th
                    key={stage.id}
                    scope="col"
                    className="h-10 px-4 text-center text-label font-normal"
                  >
                    {stage.name}
                  </th>
                ))}
                <th scope="col" className="h-10 pl-4 text-right text-label font-normal">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => {
                const members = cases.filter((testCase) => testCase.family === family.id)
                const exercised = new Set(members.flatMap((testCase) => testCase.stages))
                return (
                  <tr key={family.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3.5 pr-4 text-left font-normal">
                      {family.name}
                      <span className="ml-2 text-label">
                        {members.length} {members.length === 1 ? "case" : "cases"}
                      </span>
                    </th>
                    {stages.map((stage) => {
                      const on = exercised.has(stage.id)
                      return (
                        <td key={stage.id} className="px-4 text-center">
                          <span
                            role="img"
                            aria-label={
                              on ? `exercises ${stage.name}` : `does not exercise ${stage.name}`
                            }
                            className={cn(
                              "inline-block rounded-full",
                              on ? "size-2.5 bg-accent" : "h-px w-4 bg-line-strong align-middle",
                            )}
                          />
                        </td>
                      )
                    })}
                    <td className="pl-4 text-right font-mono text-xs text-fg-muted">⅓</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  )
}

/** Compact "Cairo proof → Wrap → Fold → root" line for the challenge hero. */
export function StageStrip({ challenge }: { challenge: Challenge }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-label">Proof pipeline</span>
      {challenge.stages.map((stage, index) => (
        <span key={stage.id} className="inline-flex items-center gap-2">
          {index > 0 ? <ArrowRight className="size-3 text-fg-faint" aria-hidden /> : null}
          <span className="rounded-full border border-line px-2.5 py-0.5">{stage.name}</span>
        </span>
      ))}
      <ArrowRight className="size-3 text-fg-faint" aria-hidden />
      <span className="text-fg-muted">one recursive root</span>
    </p>
  )
}
