import { notFound } from "next/navigation"

import {
  getChallenge,
  getChallenges,
  getProofProgress,
  getResearchCases,
  getResearchReviews,
  getScorecards,
  getSite,
} from "@/data/source"
import { Faq } from "@/features/faq/faq"
import { Hero } from "@/features/hero/hero"
import { StepsSection } from "@/features/how/steps-section"
import { ChallengeShowcase } from "@/features/landing/challenge-showcase"
import { Participate } from "@/features/participate/participate"
import { summarize } from "@/lib/scoring"
import {
  buildCandidates,
  cairoProgress,
  candidateHighlight,
  historyMilestones,
} from "@/lib/candidates"
import { getCommitDates, getResearchActivity } from "@/lib/github-research"

export const revalidate = 300

export default async function HomePage() {
  const site = await getSite()
  const [featured, featuredScorecards, challenges] = await Promise.all([
    getChallenge(site.featuredChallenge),
    getScorecards(site.featuredChallenge),
    getChallenges(),
  ])
  if (!featured) notFound()
  const entries = await Promise.all(
    challenges.map(async (challenge) => {
      const [scorecards, reviews, measurements, proofProgress] = await Promise.all([
        getScorecards(challenge.slug),
        getResearchReviews(challenge.slug),
        getResearchCases(challenge.slug),
        getProofProgress(challenge.slug),
      ])
      const activity = await getResearchActivity(challenge.links.repo)
      const commitDates = await getCommitDates(
        challenge.links.repo,
        reviews.map((review) => review.headSha),
      )
      const candidates = buildCandidates(
        challenge,
        reviews,
        measurements,
        activity.pulls,
        commitDates,
      )
      return {
        challenge,
        scorecards,
        candidates: candidates.length,
        highlight: candidateHighlight(candidates, challenge.focus.family),
        progress: cairoProgress(
          candidates,
          historyMilestones(proofProgress),
          challenge.focus.family,
        ),
      }
    }),
  )
  const featuredEntry = entries.find((entry) => entry.challenge.slug === featured.slug)

  return (
    <>
      <Hero
        site={site}
        challenges={challenges}
        featured={featured}
        summary={summarize(featured, featuredScorecards)}
        highlight={featuredEntry?.highlight ?? null}
        progress={featuredEntry?.progress ?? null}
        candidates={entries.reduce((total, entry) => total + entry.candidates, 0)}
      />
      <ChallengeShowcase entries={entries} proposeUrl={featured.links.discussions} />
      <StepsSection
        id="how"
        index="02"
        eyebrow="How it works"
        heading={
          <>
            One workload. One rig. <em className="font-display font-normal">No</em> self-reporting.
          </>
        }
        steps={site.howItWorks}
      />
      <Participate index="03" steps={site.participate} />
      <Faq index="04" items={site.faq} />
    </>
  )
}
