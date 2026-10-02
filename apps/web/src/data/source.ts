import "server-only"

import { cache } from "react"

import stwoCudaContent from "./content/challenges/stwo-cuda/challenge.json"
import siteJson from "./content/site.json"
import stwoCudaCases from "./imported/stwo-cuda/cases.json"
import stwoCudaContract from "./imported/stwo-cuda/contract.json"
import stwoCudaScorecards from "./imported/stwo-cuda/scorecards.json"
import stwoCudaResearchReviews from "./imported/stwo-cuda/research-reviews.json"
import stwoCudaResearchCases from "./imported/stwo-cuda/research-cases.json"
import {
  caseMeasuredSchema,
  challengeContentSchema,
  challengeSchema,
  contractImportedSchema,
  scorecardSchema,
  researchReviewSchema,
  researchCaseSchema,
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
 * - content/   authored copy: names, stage and case descriptions, tracks, rules, gates.
 * - imported/  measured facts from the challenge repository (`bun run data:import`):
 *              contract, per-case baselines, and judge scorecards.
 *
 * To go live against an API, replace these bodies with `fetch` calls; the zod schemas keep
 * validating at the boundary. Register a new challenge by adding both folders below.
 */
const CHALLENGES: Record<
  string,
  { content: unknown; contract: unknown; cases: unknown; scorecards: unknown }
> = {
  "stwo-cuda": {
    content: stwoCudaContent,
    contract: stwoCudaContract,
    cases: stwoCudaCases,
    scorecards: stwoCudaScorecards,
  },
}

/** Join authored content with imported measurements; every case must have both. */
function joinChallenge(entry: (typeof CHALLENGES)[string]): Challenge {
  const content = challengeContentSchema.parse(entry.content)
  const contract = contractImportedSchema.parse(entry.contract)
  if (content.contract.epoch !== contract.contractEpoch)
    throw new Error(
      `Website epoch ${content.contract.epoch} differs from imported challenge ${contract.contractEpoch}`,
    )
  const measured = new Map(
    caseMeasuredSchema
      .array()
      .parse(entry.cases)
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
    contract: { ...content.contract, ...contract },
    cases,
  })
}

export const getSite = cache(async (): Promise<Site> => {
  await Promise.resolve()
  return siteSchema.parse(siteJson)
})

export const getChallenges = cache(async (): Promise<readonly Challenge[]> => {
  await Promise.resolve()
  return Object.values(CHALLENGES).map(joinChallenge)
})

export const getChallenge = cache(async (slug: string): Promise<Challenge | undefined> => {
  const challenges = await getChallenges()
  return challenges.find((challenge) => challenge.slug === slug)
})

/** Judge-signed rank scorecards, oldest first. Empty until the H200 judge is live. */
export const getScorecards = cache(async (slug: string): Promise<readonly Scorecard[]> => {
  await Promise.resolve()
  const entry = CHALLENGES[slug]
  if (!entry) return []
  const content = challengeContentSchema.parse(entry.content)
  if (content.status !== "live") return []
  return scorecardSchema
    .array()
    .parse(entry.scorecards)
    .toSorted((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
})

export const getResearchReviews = cache(
  async (slug: string): Promise<readonly ResearchReview[]> => {
    await Promise.resolve()
    return slug === "stwo-cuda" ? researchReviewSchema.array().parse(stwoCudaResearchReviews) : []
  },
)

export const getResearchCases = cache(async (slug: string): Promise<readonly ResearchCase[]> => {
  await Promise.resolve()
  return slug === "stwo-cuda" ? researchCaseSchema.array().parse(stwoCudaResearchCases) : []
})
