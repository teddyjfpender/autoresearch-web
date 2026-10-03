import "server-only"

import { cache } from "react"

import stwoContent from "./content/challenges/stwo/challenge.json"
import siteJson from "./content/site.json"
import { getChallengeRepositoryData } from "./github-challenge"
import { latestObservations, type BackendId } from "./proof-parser"
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
  type ProofProgress,
  type Site,
} from "./schema"

/**
 * The only module that knows where data comes from.
 *
 * - content/   authored copy: names, stage and case descriptions, tracks, rules.
 * - github-challenge.ts fetches one immutable revision of the challenge repository for
 *   measured facts, reviewed PRs, and independently checked signed scorecards.
 */
/** Shared challenge definitions; each expands into one route per backend. */
const CHALLENGE_FAMILIES: readonly unknown[] = [stwoContent]

type Imported = Awaited<ReturnType<typeof getChallengeRepositoryData>>
type Gate = Challenge["gates"][number]

/** Per-case measured facts for one backend, in the shared measured-case shape. */
function measuredFor(backend: BackendId, imported: Imported, pin: string | null) {
  const v1 = new Map(
    caseMeasuredSchema
      .array()
      .parse(imported.cases)
      .map((testCase) => [testCase.id, testCase]),
  )
  if (backend === "cuda")
    return new Map(
      [...v1].map(([id, testCase]) => [
        id,
        {
          ...testCase,
          baseline: {
            ...testCase.baseline,
            source: "Historical H200 direct observation on the previous source pin",
            proofTimeScope: `${testCase.baseline.proofTimeScope}; historical, unranked`,
          },
        },
      ]),
    )
  const observed = latestObservations(imported.proofObservations, backend, pin)
  const shapes = imported.proofFixture?.cases ?? []
  return new Map(
    [...v1.values()].map((testCase) => {
      const shape = shapes.find((item) => item.id === testCase.id)
      const observation = observed.get(testCase.id)
      const proofTimeS = observation?.isolated === true ? observation.proofS : null
      return [
        testCase.id,
        caseMeasuredSchema.parse({
          id: testCase.id,
          family: shape?.family ?? testCase.family,
          ...(testCase.blocks ? { blocks: testCase.blocks } : {}),
          ...(testCase.osSteps === undefined ? {} : { osSteps: testCase.osSteps }),
          ...(testCase.leaves === undefined ? {} : { leaves: testCase.leaves }),
          baseline: {
            proofTimeS,
            runProofTimesS: proofTimeS === null ? [] : [proofTimeS],
            proofTimeScope:
              observation === undefined
                ? "Not yet proved on this host"
                : observation.isolated
                  ? "Proof execution on this host"
                  : "Pending: the recorded interval still includes setup work",
            arenaBytes: null,
            commandTimeS: null,
            peakBytes: observation?.peakBytes ?? null,
            rounds: observation === undefined ? 0 : 1,
            source: "M5 Max direct observation",
          },
        }),
      ] as const
    }),
  )
}

/** Gates for backends without their own activation record, derived from observations. */
function derivedGates(cases: Challenge["cases"], host: string): Gate[] {
  const proved = cases.filter((testCase) => testCase.baseline.rounds > 0).length
  const isolated = cases.filter((testCase) => testCase.baseline.proofTimeS !== null).length
  const status = (done: number): Gate["status"] =>
    done === cases.length ? "done" : done > 0 ? "partial" : "pending"
  return [
    {
      name: "Public jobs proved on this host",
      status: status(proved),
      evidence: `${String(proved)} of ${String(cases.length)} jobs reproduced their exact reference output on ${host}.`,
    },
    {
      name: "Isolated proof-stage timers",
      status: status(isolated),
      evidence: `${String(isolated)} of ${String(cases.length)} jobs have a proof-only interval.`,
    },
    {
      name: "Judged baseline",
      status: "pending",
      evidence: "Paired, sandboxed baseline runs on this host have not been recorded.",
    },
  ]
}

/** Expand one shared definition into one challenge per backend. */
function joinChallenges(raw: unknown, imported: Imported): Challenge[] {
  const content = challengeContentSchema.parse(raw)
  const v1 = contractImportedSchema.parse(imported.contract)
  const proof = imported.proofContract
  const siblings = content.backends.map(({ id, slug, name }) => ({ id, slug, name }))
  return content.backends.map((backend) => {
    const spec = proof?.backends[backend.id]
    const measured = measuredFor(backend.id, imported, proof?.sourceCommit ?? null)
    const cases = content.cases.map((testCase) => {
      const facts = measured.get(testCase.id)
      if (!facts) throw new Error(`No measurements for case ${testCase.id}`)
      return { ...facts, ...testCase }
    })
    const observedDates = imported.proofObservations
      .filter((row) => row.backend === backend.id && row.observedAt !== null)
      .map((row) => row.observedAt ?? "")
      .toSorted()
    const host = spec?.host ?? v1.hardware.gpu
    const contract = contractImportedSchema.parse({
      ...v1,
      backend: backend.id,
      contractEpoch: proof?.contractEpoch ?? v1.contractEpoch,
      sourceCommit: proof?.sourceCommit ?? v1.sourceCommit,
      sourceRepository: proof?.sourceRepository.replace(/\.git$/, "") ?? v1.sourceRepository,
      security: proof?.security ?? v1.security,
      editablePaths: spec?.editablePaths ?? v1.editablePaths,
      baselineMeasuredAt:
        backend.id === "cuda"
          ? v1.baselineMeasuredAt
          : (observedDates.at(-1) ?? v1.baselineMeasuredAt),
      hardware: {
        gpu: host,
        deviceBytes:
          spec?.deviceBytes ??
          spec?.unifiedMemoryBytes ??
          spec?.systemMemoryBytes ??
          v1.hardware.deviceBytes,
        ...(spec?.reserveBytes === undefined
          ? backend.id === "cuda" && v1.hardware.reserveBytes !== undefined
            ? { reserveBytes: v1.hardware.reserveBytes }
            : {}
          : { reserveBytes: spec.reserveBytes }),
      },
    })
    return challengeSchema.parse({
      ...content,
      ...backend,
      backend: backend.id,
      siblings,
      status: proof?.status ?? imported.activation.status,
      gates: backend.id === "cuda" ? imported.activation.gates : derivedGates(cases, host),
      contract: { ...content.contract, ...contract },
      cases,
      participate: content.participate.map((step) =>
        step.command === undefined
          ? step
          : { ...step, command: step.command.replaceAll("{backend}", backend.id) },
      ),
    })
  })
}

export const getSite = cache(async (): Promise<Site> => {
  await Promise.resolve()
  return siteSchema.parse(siteJson)
})

export const getChallenges = cache(async (): Promise<readonly Challenge[]> => {
  const imported = await getChallengeRepositoryData()
  return CHALLENGE_FAMILIES.flatMap((raw) => joinChallenges(raw, imported))
})

export const getChallenge = cache(async (slug: string): Promise<Challenge | undefined> => {
  const challenges = await getChallenges()
  return challenges.find((challenge) => challenge.slug === slug)
})

/** The H200 research feed and judge receipts belong to the CUDA backend route. */
const isCuda = async (slug: string) => (await getChallenge(slug))?.backend === "cuda"

/** Judge-signed rank scorecards, oldest first. Empty until the H200 judge is live. */
export const getScorecards = cache(async (slug: string): Promise<readonly Scorecard[]> => {
  if (!(await isCuda(slug))) return []
  const imported = await getChallengeRepositoryData()
  if (imported.activation.status !== "live") return []
  return imported.scorecards.toSorted(
    (a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt),
  )
})

export const getResearchReviews = cache(async (slug: string): Promise<readonly ResearchReview[]> =>
  (await isCuda(slug)) ? (await getChallengeRepositoryData()).reviews : [],
)

export const getResearchCases = cache(async (slug: string): Promise<readonly ResearchCase[]> =>
  (await isCuda(slug)) ? (await getChallengeRepositoryData()).researchCases : [],
)

export const getProofProgress = cache(async (slug: string): Promise<readonly ProofProgress[]> =>
  (await isCuda(slug)) ? (await getChallengeRepositoryData()).proofProgress : [],
)

/** Retained only for the archived ingress component; proof routes do not render it. */
