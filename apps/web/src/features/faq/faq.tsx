import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@autoresearch/ui/components/accordion"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"

import type { Faq as FaqItem } from "@/data/schema"

export function Faq({ items, index }: { items: readonly FaqItem[]; index: string }) {
  return (
    <Section id="faq" className="border-t border-line">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <Reveal>
            <Eyebrow index={index}>Questions</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <Heading className="mt-6 text-4xl sm:text-5xl lg:text-6xl">Fair questions.</Heading>
          </Reveal>
        </div>
        <Reveal delay={0.15}>
          <Accordion type="single" collapsible className="border-t border-line">
            {items.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </Section>
  )
}
