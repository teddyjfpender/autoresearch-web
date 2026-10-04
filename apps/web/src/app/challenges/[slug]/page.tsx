import { Container } from "@autoresearch/ui/components/layout"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getChallenge,
  getChallenges,
  getProofProgress,
  getResearchCases,
  getResearchReviews,
  getScorecards,
} from "@/data/source"
import { ChallengeBoard } from "@/features/board/challenge-board"
import { ChallengeDetails } from "@/features/board/challenge-details"
import { DiscussionPanel } from "@/features/board/discussion-panel"
import { ChallengeHero } from "@/features/challenge/challenge-hero"
import { ProgressChart } from "@/features/chart/progress-chart"
import { ProofTypes } from "@/features/board/proof-types"
import {
  buildCandidates,
  cairoProgress,
  firstProofTimes,
  historyMilestones,
} from "@/lib/candidates"
import { getCommitDates, getResearchActivity } from "@/lib/github-research"
import { summarize } from "@/lib/scoring"

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
  const [challenge, scorecards, reviews, measurements, proofProgress] = await Promise.all([
    getChallenge(slug),
    getScorecards(slug),
    getResearchReviews(slug),
    getResearchCases(slug),
    getProofProgress(slug),
  ])
  if (!challenge) notFound()
  const activity = await getResearchActivity(challenge.links.repo)
  const summary = summarize(challenge, scorecards)
  const commitDates = await getCommitDates(
    challenge.links.repo,
    reviews.map((review) => review.headSha),
  )
  const candidates = buildCandidates(challenge, reviews, measurements, activity.pulls, commitDates)
  const history = historyMilestones(proofProgress)

  return (
    <>
      <ChallengeHero
        challenge={challenge}
        summary={summary}
        candidates={candidates}
        firstProof={firstProofTimes(proofProgress)}
        progress={cairoProgress(candidates, history, challenge.focus.family)}
      />
      <Container className="pb-24">
        <ChallengeBoard
          candidates={candidates}
          families={challenge.families}
          tracks={challenge.tracks}
          baselineDate={challenge.contract.baselineMeasuredAt}
          history={history}
          historyBucket={challenge.focus.family}
          proofs={<ProofTypes challenge={challenge} />}
          rankedChart={
            summary.ranked > 0 ? (
              <ProgressChart
                scored={summary.scored}
                minImprovement={challenge.contract.minImprovement}
                baselineDate={challenge.contract.baselineMeasuredAt}
              />
            ) : null
          }
          discussionCount={activity.discussions?.length ?? null}
          discussion={
            <DiscussionPanel
              activity={activity}
              discussionsUrl={challenge.links.discussions}
              pullsUrl={`${challenge.links.repo}/pulls`}
            />
          }
          details={<ChallengeDetails challenge={challenge} />}
        />
      </Container>
    </>
  )
}
