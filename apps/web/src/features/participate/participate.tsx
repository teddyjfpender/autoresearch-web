import { CopyCommand } from "@autoresearch/ui/components/copy-command"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { Check } from "lucide-react"
import type { ReactNode } from "react"

import type { Step } from "@/data/schema"

export interface ParticipateProps {
  index: string
  steps: readonly Step[]
  rules?: readonly string[]
  /** Extra content under the steps, e.g. a CTA into a challenge. */
  footer?: ReactNode
}

export function Participate({ index, steps, rules, footer }: ParticipateProps) {
  return (
    <Section id="participate" className="border-t border-line">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow index={index}>Participate</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6 max-w-[14ch]">
                Bring an idea. <em className="font-display font-normal">Or an agent.</em>
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-md text-fg-muted">
              Humans, models and harnesses can publish reviewable research now. These{" "}
              {String(steps.length)} steps are the same for every challenge; each challenge page has
              its exact commands.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {steps.map((step, stepIndex) => (
            <Reveal key={step.title} delay={stepIndex * 0.08} className="h-full">
              <Spotlight className="flex h-full flex-col gap-8 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-2xl font-normal tracking-tight">{step.title}</h3>
                  <span className="font-display text-5xl leading-none text-fg-faint italic transition-colors duration-500 group-hover/spot:text-fg-muted">
                    {stepIndex + 1}
                  </span>
                </div>
                <p className="text-fg-muted">{step.body}</p>
                {step.command === undefined ? null : (
                  <CopyCommand command={step.command} className="mt-auto" />
                )}
              </Spotlight>
            </Reveal>
          ))}
        </div>

        {rules === undefined ? null : (
          <Reveal delay={0.1}>
            <div className="mt-16 border-t border-line pt-10">
              <p className="text-label">House rules</p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-3 text-sm">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-fg-muted">
                      <Check className="size-3" />
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}
        {footer}
      </Container>
    </Section>
  )
}
