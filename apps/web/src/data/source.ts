import "server-only"

import { cache } from "react"

import stwoCudaContent from "./content/challenges/stwo-cuda/challenge.json"
import siteJson from "./content/site.json"
import { getChallengeRepositoryData } from "./github-challenge"
import {
  caseMeasuredSchema,
  challengeContentSchema,
  challengeSchema,
  contractImportedSchema,
  siteSchema,
  type Challenge,
  type Scorecard,
  type ResearchReview,
  type ResearchCase,
  type Site,
} from "./schema"

/**
 * The only module that knows where data comes from.
 *
 * - content/   authored copy: names, stage and case descriptions, tracks, rules.
 * - github-challenge.ts fetches one immutable revision of the challenge repository for
 *   measured facts, reviewed PRs, and independently checked signed scorecards.
 */
const CHALLENGES: Record<string, { content: unknown }> = {
  "stwo-cuda": {
    content: stwoCudaContent,
  },
}

/** Join authored content with imported measurements; every case must have both. */
function joinChallenge(
  entry: (typeof CHALLENGES)[string],
  imported: Awaited<ReturnType<typeof getChallengeRepositoryData>>,
): Challenge {
  const content = challengeContentSchema.parse(entry.content)
  const contract = contractImportedSchema.parse(imported.contract)
  if (content.contract.epoch !== contract.contractEpoch)
    throw new Error(
      `Website epoch ${content.contract.epoch} differs from imported challenge ${contract.contractEpoch}`,
    )
  const measured = new Map(
    caseMeasuredSchema
      .array()
      .parse(imported.cases)
      .map((testCase) => [testCase.id, testCase]),
  )
  const cases = content.cases.map((testCase) => {
    const facts = measured.get(testCase.id)
    if (!facts) throw new Error(`No imported measurements for case ${testCase.id}`)
    return { ...facts, ...testCase }
  })
  const unknown = [...measured.keys()].filter((id) => !content.cases.some((c) => c.id === id))
  if (unknown.length > 0) throw new Error(`Imported cases without content: ${unknown.join(", ")}`)
  return challengeSchema.parse({
    ...content,
    status: imported.activation.status,
    gates: imported.activation.gates,
    contract: { ...content.contract, ...contract },
    cases,
  })
}

export const getSite = cache(async (): Promise<Site> => {
  await Promise.resolve()
  return siteSchema.parse(siteJson)
})

export const getChallenges = cache(async (): Promise<readonly Challenge[]> => {
  const imported = await getChallengeRepositoryData()
  return Object.values(CHALLENGES).map((entry) => joinChallenge(entry, imported))
})

export const getChallenge = cache(async (slug: string): Promise<Challenge | undefined> => {
  const challenges = await getChallenges()
  return challenges.find((challenge) => challenge.slug === slug)
})

/** Judge-signed rank scorecards, oldest first. Empty until the H200 judge is live. */
export const getScorecards = cache(async (slug: string): Promise<readonly Scorecard[]> => {
  const entry = CHALLENGES[slug]
  if (!entry) return []
  const imported = await getChallengeRepositoryData()
  if (imported.activation.status !== "live") return []
  return imported.scorecards.toSorted(
    (a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt),
  )
})

export const getResearchReviews = cache(async (slug: string): Promise<readonly ResearchReview[]> =>
  slug === "stwo-cuda" ? (await getChallengeRepositoryData()).reviews : [],
)

export const getResearchCases = cache(async (slug: string): Promise<readonly ResearchCase[]> =>
  slug === "stwo-cuda" ? (await getChallengeRepositoryData()).researchCases : [],
)

export const getIngressStudy = cache(async (slug: string) =>
  slug === "stwo-cuda" ? (await getChallengeRepositoryData()).ingressStudy : [],
)
