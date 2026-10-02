import { Container } from "@autoresearch/ui/components/layout"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getChallenge,
  getChallenges,
  getResearchCases,
  getResearchReviews,
  getScorecards,
} from "@/data/source"
import { ChallengeHero } from "@/features/challenge/challenge-hero"
import { JudgingSection } from "@/features/judging/judging-section"
import { Leaderboard } from "@/features/leaderboard/leaderboard"
import { Participate } from "@/features/participate/participate"
import { ResearchSection } from "@/features/research/research-section"
import { ScoringSection } from "@/features/scoring/scoring-section"
import { WorkloadSection } from "@/features/workload/workload-section"
import { summarize } from "@/lib/scoring"
import { getResearchActivity } from "@/lib/github-research"

interface Props {
  params: Promise<{ slug: string }>
}

// Refresh GitHub research metadata while keeping candidate claims separate from ranked receipts.
export const revalidate = 300

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const challenges = await getChallenges()
  return challenges.map((challenge) => ({ slug: challenge.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const challenge = await getChallenge(slug)
  return challenge ? { title: challenge.name, description: challenge.summary } : {}
}

export default async function ChallengePage({ params }: Props) {
  const { slug } = await params
  const [challenge, scorecards, reviews, measurements] = await Promise.all([
    getChallenge(slug),
    getScorecards(slug),
    getResearchReviews(slug),
    getResearchCases(slug),
  ])
  if (!challenge) notFound()
  const activity = await getResearchActivity(challenge.links.repo)
  const summary = summarize(challenge, scorecards)

  return (
    <>
      <ChallengeHero challenge={challenge} summary={summary} />
      <Leaderboard
        slug={slug}
        scored={summary.scored}
        tracks={challenge.tracks}
        minImprovement={challenge.contract.minImprovement}
        activation={{
          done: challenge.gates.filter((gate) => gate.status === "done").length,
          total: challenge.gates.length,
        }}
      />
      <ResearchSection
        activity={activity}
        reviews={reviews}
        measurements={measurements}
        repositoryUrl={challenge.links.repo}
        discussionsUrl={challenge.links.discussions}
      />
      <WorkloadSection challenge={challenge} />
      <ScoringSection challenge={challenge} />
      <JudgingSection challenge={challenge} />
      <Participate
        index="07"
        steps={challenge.participate}
        rules={challenge.rules}
        footer={
          <Container className="mt-10 px-0 sm:px-0 lg:px-0">
            <p className="text-label">Editable paths in stwo-zig</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {challenge.contract.editablePaths.map((path) => (
                <li
                  key={path}
                  className="rounded-full border border-line px-3 py-1 font-mono text-xs text-fg-muted"
                >
                  {path}
                </li>
              ))}
            </ul>
          </Container>
        }
      />
    </>
  )
}
