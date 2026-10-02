import { notFound } from "next/navigation"

import {
  getChallenge,
  getChallenges,
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
import { buildCandidates, candidateHighlight } from "@/lib/candidates"
import { getResearchActivity } from "@/lib/github-research"

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
      const [scorecards, reviews, measurements] = await Promise.all([
        getScorecards(challenge.slug),
        getResearchReviews(challenge.slug),
        getResearchCases(challenge.slug),
      ])
      const activity = await getResearchActivity(challenge.links.repo)
      const candidates = buildCandidates(challenge, reviews, measurements, activity.pulls)
      return { challenge, scorecards, highlight: candidateHighlight(candidates) }
    }),
  )
  const featuredHighlight =
    entries.find((entry) => entry.challenge.slug === featured.slug)?.highlight ?? null

  return (
    <>
      <Hero
        challenge={featured}
        summary={summarize(featured, featuredScorecards)}
        highlight={featuredHighlight}
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
