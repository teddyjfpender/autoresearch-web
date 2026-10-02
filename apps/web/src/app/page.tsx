import { notFound } from "next/navigation"

import { getChallenge, getChallenges, getScorecards, getSite } from "@/data/source"
import { Faq } from "@/features/faq/faq"
import { Hero } from "@/features/hero/hero"
import { StepsSection } from "@/features/how/steps-section"
import { ChallengeShowcase } from "@/features/landing/challenge-showcase"
import { Participate } from "@/features/participate/participate"
import { summarize } from "@/lib/scoring"

export default async function HomePage() {
  const site = await getSite()
  const [featured, featuredScorecards, challenges] = await Promise.all([
    getChallenge(site.featuredChallenge),
    getScorecards(site.featuredChallenge),
    getChallenges(),
  ])
  if (!featured) notFound()
  const entries = await Promise.all(
    challenges.map(async (challenge) => ({
      challenge,
      scorecards: await getScorecards(challenge.slug),
    })),
  )

  return (
    <>
      <Hero challenge={featured} summary={summarize(featured, featuredScorecards)} />
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
