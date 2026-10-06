import { Button } from "@autoresearch/ui/components/button"
import { Carousel } from "@autoresearch/ui/components/carousel"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ArrowUpRight, Plus } from "lucide-react"

import type { CircuitChallenge } from "@/data/circuit/schema"
import type { Challenge } from "@/data/schema"
import type { CairoProgress, CandidateHighlight } from "@/lib/candidates"
import { routes } from "@/lib/routes"

import { StatusBadge } from "../challenge/status-badge"
import { CircuitCard } from "./circuit-card"
import { ShowcaseCard } from "./showcase-card"

export interface ShowcaseEntry {
  challenge: Challenge
  highlight: CandidateHighlight | null
  progress: CairoProgress | null
}

/** A proving challenge's card: proof time removed, from the strongest evidence available. */
function ChallengeCard({ challenge, progress, highlight }: ShowcaseEntry) {
  const lead = progress
    ? { figure: progress.reduction * 100, label: `less ${challenge.focus.label} time` }
    : highlight
      ? { figure: (1 - 1 / (1 + highlight.fullBasketGain)) * 100, label: "less proof time" }
      : { figure: null, label: "No one has beaten the baseline yet" }
  return (
    <ShowcaseCard
      href={routes.challenge(challenge.slug)}
      status={<StatusBadge status={challenge.status} />}
      name={challenge.name}
      headline={challenge.headline}
      {...lead}
    />
  )
}

export function ChallengeShowcase({
  entries,
  circuits,
  proposeUrl,
}: {
  entries: readonly ShowcaseEntry[]
  /** Circuit challenges, shown after the proving races. */
  circuits: readonly CircuitChallenge[]
  proposeUrl: string
}) {
  return (
    <Section id="challenges">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Reveal>
              <Eyebrow index="01">Challenges</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading className="mt-6 max-w-[14ch]">
                Pick a race. <em className="font-display font-normal">Move</em> the frontier.
              </Heading>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-md text-fg-muted">
              One problem, one judge, one score. The number on each card is how far the best result
              has moved it.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-14">
          <Carousel
            label="Challenges"
            slideClassName="basis-[86%] sm:basis-[47%] lg:basis-[31.5%]"
            slides={[
              ...entries.map((entry) => ({
                id: entry.challenge.slug,
                content: <ChallengeCard {...entry} />,
              })),
              ...circuits.map((challenge) => ({
                id: challenge.slug,
                content: <CircuitCard challenge={challenge} />,
              })),
              {
                id: "next-race",
                content: (
                  <div className="flex h-full min-h-[21rem] flex-col justify-between gap-6 rounded-2xl border border-dashed border-line p-6 sm:p-7">
                    <span className="inline-flex size-12 items-center justify-center rounded-full border border-line text-fg-faint">
                      <Plus className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-normal tracking-tight">Next race</h3>
                      <p className="mt-3 text-fg-muted">
                        Have a hard problem with a clean, verifiable score? Propose it as the next
                        challenge.
                      </p>
                    </div>
                    <Button asChild variant="outline" className="self-start">
                      <a href={proposeUrl} target="_blank" rel="noreferrer">
                        Propose a challenge
                        <ArrowUpRight />
                      </a>
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Reveal>
      </Container>
    </Section>
  )
}
