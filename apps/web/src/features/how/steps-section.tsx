import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import type { ReactNode } from "react"

import type { Step } from "@/data/schema"

import { StepList } from "./step-list"

export interface StepsSectionProps {
  id: string
  index: string
  eyebrow: string
  heading: ReactNode
  steps: readonly Step[]
  /** Rendered under the sticky heading, e.g. a spec sheet. */
  aside?: ReactNode
}

/** Sticky heading on the left, scroll-progress step list on the right. */
export function StepsSection({ id, index, eyebrow, heading, steps, aside }: StepsSectionProps) {
  return (
    <Section id={id} className="border-t border-line">
      <Container className="grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <Eyebrow index={index}>{eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <Heading className="mt-6">{heading}</Heading>
          </Reveal>
          {aside === undefined ? null : <Reveal delay={0.2}>{aside}</Reveal>}
        </div>
        <StepList steps={steps} />
      </Container>
    </Section>
  )
}

export function SpecList({ specs }: { specs: readonly { label: string; value: string }[] }) {
  return (
    <dl className="mt-10 divide-y divide-line rounded-2xl border border-line bg-bg-raised">
      {specs.map((spec) => (
        <div key={spec.label} className="flex items-baseline justify-between gap-6 px-5 py-3.5">
          <dt className="text-label">{spec.label}</dt>
          <dd className="text-right text-sm">{spec.value}</dd>
        </div>
      ))}
    </dl>
  )
}
