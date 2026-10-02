import { Avatar } from "@autoresearch/ui/components/avatar"
import { Badge } from "@autoresearch/ui/components/badge"
import { Button } from "@autoresearch/ui/components/button"
import { CopyCommand } from "@autoresearch/ui/components/copy-command"
import { Formula } from "@autoresearch/ui/components/formula"
import { Container } from "@autoresearch/ui/components/layout"
import { Stat } from "@autoresearch/ui/components/stat"
import { cn } from "@autoresearch/ui/lib/cn"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ScrambleText } from "@autoresearch/ui/motion/scramble-text"
import { SplitText } from "@autoresearch/ui/motion/split-text"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getChallenge, getChallenges, getScorecards } from "@/data/source"
import { RatioCell } from "@/features/scorecard/ratio-cell"
import { SectionLink } from "@/features/site/section-link"
import { authorLine } from "@/lib/authors"
import { formatDateTime } from "@/lib/dates"
import { formatRatio, formatScore } from "@/lib/format"
import { METRICS } from "@/lib/metrics"
import { routes } from "@/lib/routes"
import { summarize } from "@/lib/scoring"

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export async function generateStaticParams(): Promise<{ slug: string; id: string }[]> {
  const challenges = await getChallenges()
  const perChallenge = await Promise.all(
    challenges.map(async (challenge) =>
      (await getScorecards(challenge.slug)).map((card) => ({ slug: challenge.slug, id: card.id })),
    ),
  )
  return perChallenge.flat()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params
  const card = (await getScorecards(slug)).find((item) => item.id === id)
  return card
    ? { title: `${authorLine(card.authors)}: ${card.title}`, description: card.notes }
    : {}
}

export default async function ScorecardPage({ params }: Props) {
  const { slug, id } = await params
  const [challenge, cards] = await Promise.all([getChallenge(slug), getScorecards(slug)])
  if (!challenge) notFound()
  const summary = summarize(challenge, cards)
  const scored = summary.scored.find((entry) => entry.card.id === id)
  if (!scored) notFound()
  const { card } = scored
  const leading = challenge.tracks.filter(
    (track) => summary.leaders[track.id]?.scored.card.id === id,
  )
  const onFrontier = summary.frontier.some((entry) => entry.card.id === id)
  const results = new Map(card.perCase.map((result) => [result.caseId, result]))

  return (
    <article className="pt-32 pb-24">
      <Container>
        <Reveal y={8}>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <SectionLink href={routes.challengeSection(slug, "leaderboard")}>
              <ArrowLeft className="transition-transform duration-300 group-hover/button:-translate-x-0.5" />
              {challenge.name} leaderboard
            </SectionLink>
          </Button>
        </Reveal>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {leading.map((track) => (
            <Badge key={track.id} tone="accent">
              {track.name} leader
            </Badge>
          ))}
          {onFrontier ? <Badge>Pareto frontier</Badge> : null}
          <Badge>Rank tier · {challenge.contract.epoch}</Badge>
          {card.model === null ? null : <Badge>{card.model}</Badge>}
        </div>

        <h1 className="mt-6 max-w-[22ch] text-5xl leading-[0.98] font-normal tracking-[-0.045em] sm:text-7xl">
          <SplitText text={card.title} />
        </h1>
        <Reveal delay={0.25}>
          <p className="mt-6 max-w-2xl leading-relaxed text-fg-muted">{card.notes}</p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-12 grid gap-10 border-y border-line py-10 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label={
                <>
                  <Formula>R_T</Formula> · command time
                </>
              }
              value={formatRatio(scored.rTime)}
              hint={METRICS.rTime.hint}
            />
            <Stat
              label={
                <>
                  <Formula>R_M</Formula> · device peak
                </>
              }
              value={formatRatio(scored.rMemory)}
              hint={METRICS.rMemory.hint}
            />
            {challenge.tracks.map((track) => {
              const result = scored.tracks[track.id]
              return (
                <Stat
                  key={track.id}
                  label={track.name}
                  value={result.score === null ? "—" : formatScore(result.score)}
                  hint={
                    <Formula>
                      {result.eligible ? track.formula : `Barred: ${result.failures[0] ?? ""}`}
                    </Formula>
                  }
                />
              )
            })}
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <section aria-labelledby="per-case" className="mt-16">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-4">
              <h2 id="per-case" className="text-2xl font-normal tracking-tight">
                Per case
              </h2>
              <p className="text-label">
                Paired command-time and whole-device-peak ratios versus the fresh judge baseline
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {["Case", "Command-time ratio", "Device-peak ratio"].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="h-11 pr-4 text-left text-label font-normal"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challenge.families.map((family) =>
                    challenge.cases
                      .filter((testCase) => testCase.family === family.id)
                      .map((testCase, index) => {
                        const result = results.get(testCase.id)
                        if (!result) return null
                        return (
                          <tr
                            key={testCase.id}
                            className={cn(
                              "border-b border-line",
                              index === 0 && "border-t-line-strong",
                            )}
                          >
                            <td className="py-3.5 pr-4">
                              <span className="block">{testCase.title}</span>
                              <span className="text-label">{family.name}</span>
                            </td>
                            <td className="pr-4">
                              <RatioCell ratio={result.timeRatio} guard={1.5} />
                            </td>
                            <td className="pr-4">
                              <RatioCell ratio={result.memoryRatio} guard={1.1} />
                            </td>
                          </tr>
                        )
                      }),
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-label">
              Red marks a ratio over a track guard: 1.10 memory for latency, 1.50 time for memory
              and balanced.
            </p>
          </section>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          <Reveal>
            <section aria-labelledby="authors">
              <h2 id="authors" className="text-label">
                Authors
              </h2>
              <ul className="mt-5 space-y-3">
                {card.authors.map((author) => (
                  <li key={author.handle} className="flex items-center gap-3">
                    <Avatar name={author.handle} size="md" />
                    <span>{author.handle}</span>
                    <span className="text-sm text-fg-faint capitalize">{author.role}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
          <Reveal delay={0.05}>
            <section aria-labelledby="provenance" className="space-y-5">
              <h2 id="provenance" className="text-label">
                Provenance
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-fg-muted">Submission commit</dt>
                  <dd className="font-mono">
                    <ScrambleText text={card.commit.slice(0, 12)} />
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-fg-muted">Patch SHA-256</dt>
                  <dd className="font-mono">{card.patchSha256.slice(0, 16)}…</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-fg-muted">Pinned prover</dt>
                  <dd className="font-mono">{challenge.contract.sourceCommit.slice(0, 12)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-fg-muted">Ranked</dt>
                  <dd className="font-mono">{formatDateTime(card.submittedAt)}</dd>
                </div>
              </dl>
              <CopyCommand command={`git checkout ${card.commit.slice(0, 12)} -- candidate/`} />
            </section>
          </Reveal>
        </div>
      </Container>
    </article>
  )
}
