import { Badge } from "@autoresearch/ui/components/badge"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { cn } from "@autoresearch/ui/lib/cn"
import { Reveal } from "@autoresearch/ui/motion/reveal"

import type { Challenge, Gate } from "@/data/schema"

const GATE_LABEL: Record<Gate["status"], string> = {
  done: "Done",
  partial: "In progress",
  pending: "Pending",
}

/** Validation tiers a submission moves through, and the activation gates before ranking opens. */
export function JudgingSection({ challenge }: { challenge: Challenge }) {
  const done = challenge.gates.filter((gate) => gate.status === "done").length
  return (
    <Section id="judging" className="border-t border-line">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow index="06">Judging</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6 max-w-[16ch]">
                Rebuilt, re-run, <em className="font-display font-normal">signed</em>.
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-md text-fg-muted">
              Submissions are a patch against the pinned commit. The judge never runs a binary you
              built, and nothing is scored from a self-reported timer.
            </p>
          </Reveal>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {challenge.tiers.map((tier, index) => (
            <Reveal key={tier.id} delay={index * 0.06} className="h-full">
              <li className="flex h-full flex-col gap-4 bg-bg p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-fg-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Badge size="sm">{tier.gpu ? "H200" : "CPU"}</Badge>
                </div>
                <h3 className="text-xl font-normal tracking-tight">{tier.name}</h3>
                <p className="text-sm text-fg-muted">{tier.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1}>
          <div className="mt-16">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-4">
              <h3 className="text-2xl font-normal tracking-tight">Activation</h3>
              <p className="text-label">
                {done} of {challenge.gates.length} gates complete · ranking opens after all pass
              </p>
            </div>
            <ul className="divide-y divide-line">
              {challenge.gates.map((gate) => (
                <li
                  key={gate.name}
                  className="grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,2fr)] md:items-baseline md:gap-8"
                >
                  <span>{gate.name}</span>
                  <span className="flex items-center gap-2 text-sm text-fg-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        gate.status === "done" && "bg-fg-muted",
                        gate.status === "partial" && "bg-heat",
                        gate.status === "pending" && "border border-fg-faint",
                      )}
                    />
                    {GATE_LABEL[gate.status]}
                  </span>
                  <span className="text-sm text-fg-faint">{gate.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}
