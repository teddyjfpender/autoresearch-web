import { z } from "zod"

/**
 * Wire format for challenge data. Authored content and data imported from the challenge
 * repository must satisfy these schemas; `source.ts` validates and joins them at the
 * boundary, so the UI can trust the types.
 *
 * The challenge model mirrors the judge contract (benchmark.json + fixture manifest +
 * scorecards): one measurement set per submission, scored on several tracks.
 */

const sha = (length: number) => z.string().regex(new RegExp(`^[0-9a-f]{${String(length)}}$`))

export const authorSchema = z.object({
  handle: z.string().min(1),
  role: z.enum(["submitter", "coauthor"]),
})

export const stepSchema = z.object({
  title: z.string(),
  body: z.string(),
  command: z.string().optional(),
})

export const faqSchema = z.object({ question: z.string(), answer: z.string() })

export const trackIdSchema = z.enum(["latency", "memory", "balanced"])
export const familyIdSchema = z.enum(["pie", "recursion", "pipeline"])
export const stageIdSchema = z.enum(["cairo", "wrap", "fold"])

/** One kind of proof the challenge times: a Cairo proof, a wrap, or a fold. */
export const stageSchema = z.object({
  id: stageIdSchema,
  name: z.string(),
  summary: z.string(),
  input: z.string(),
  output: z.string(),
  /** Whether the baseline run retained a proof-stage timer for this stage. */
  baselineTimed: z.boolean(),
})

/** One eligibility guard: a paired ratio must stay at or below `max`. */
export const guardSchema = z.object({
  /** "case": every case's ratio; "aggregate": the weighted R_T / R_M. */
  scope: z.enum(["case", "aggregate"]),
  metric: z.enum(["time", "memory"]),
  max: z.number().positive(),
})

export const trackSchema = z.object({
  id: trackIdSchema,
  name: z.string(),
  objective: z.string(),
  /** Human-readable score formula, e.g. "1 / R_T". */
  formula: z.string(),
  /** Eligibility limits on paired ratios; the single source for scoring and display. */
  guards: z.array(guardSchema),
  why: z.string(),
})

export const familySchema = z.object({
  id: familyIdSchema,
  name: z.string(),
  description: z.string(),
})

/** Authored, per-case copy (content/). */
export const caseContentSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  /** Proof stages this case exercises, in pipeline order. */
  stages: z.array(stageIdSchema).min(1),
})

/** Measured, per-case facts imported from the challenge repository (imported/). */
export const caseMeasuredSchema = z.object({
  id: z.string().min(1),
  family: familyIdSchema,
  /** Inclusive Starknet block span, when the case is block-derived. */
  blocks: z.tuple([z.number().int(), z.number().int()]).optional(),
  osSteps: z.number().int().positive().optional(),
  leaves: z.number().int().positive().optional(),
  mode: z.enum(["serial", "batch_integrated"]).optional(),
  /**
   * Unranked direct H200 reference measurements. The active contract scores whole-command
   * time and whole-device peak from fresh paired judge runs; proof and arena are diagnostics.
   */
  baseline: z.object({
    /** Median proof-stage seconds, or null when the run didn't retain a proof-only timer. */
    proofTimeS: z.number().positive().nullable(),
    /** Each direct run's proof-stage seconds, for run-to-run spread. */
    runProofTimesS: z.array(z.number().positive()),
    /** What the proof-stage timer covers, or why it is unavailable. */
    proofTimeScope: z.string(),
    /** Planned resident proving arena, bytes: diagnostic, unranked direct-run memory. */
    arenaBytes: z.number().positive(),
    /** Direct-run command time, matching the scored clock but not a ranked baseline. */
    commandTimeS: z.number().positive(),
    ingressS: z.number().positive().optional(),
    peakBytes: z.number().positive(),
    rounds: z.number().int().positive(),
  }),
})

export const caseSchema = caseContentSchema.extend(caseMeasuredSchema.omit({ id: true }).shape)

export const tierSchema = z.object({
  id: z.enum(["intake", "smoke", "qualify", "rank"]),
  name: z.string(),
  gpu: z.boolean(),
  description: z.string(),
})

export const gateSchema = z.object({
  name: z.string(),
  status: z.enum(["done", "partial", "pending"]),
  evidence: z.string(),
})

/** Contract facts imported from the repository's benchmark.json. */
export const contractImportedSchema = z.object({
  contractEpoch: z.string(),
  /** When the pinned baseline was measured on the reference hardware (UTC date). */
  baselineMeasuredAt: z.iso.date(),
  /** How that baseline was measured, e.g. "direct-unranked-unsandboxed". */
  baselineQualification: z.string(),
  sourceRepository: z.url(),
  sourceCommit: sha(40),
  editablePaths: z.array(z.string()).min(1),
  hardware: z.object({
    gpu: z.string(),
    deviceBytes: z.number().positive(),
    reserveBytes: z.number().positive(),
  }),
  security: z.object({
    friQueries: z.number().int(),
    queryPowBits: z.number().int(),
    interactionPowBits: z.number().int(),
    preprocessedVariant: z.string(),
  }),
})

/** Contract choices authored for the site (the active h200-v1 epoch). */
export const contractContentSchema = z.object({
  epoch: z.string(),
  /** True while the contract is a proposal not yet adopted by the challenge repository. */
  draft: z.boolean(),
  /** What T and M measure, in one line each. */
  timeScope: z.string(),
  memoryScope: z.string(),
  /** Minimum relative improvement over the current leader to be promoted. */
  minImprovement: z.number().positive(),
  pairedRounds: z.number().int().positive(),
  bootstrapResamples: z.number().int().positive(),
})

const challengeBase = {
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  headline: z.string(),
  status: z.enum(["live", "staging", "closed"]),
  summary: z.string(),
  tracks: z.array(trackSchema).length(3),
  stages: z.array(stageSchema).length(3),
  families: z.array(familySchema).length(3),
  tiers: z.array(tierSchema).min(1),
  gates: z.array(gateSchema),
  participate: z.array(stepSchema).min(1),
  rules: z.array(z.string()).min(1),
  links: z.object({
    repo: z.url(),
    discussions: z.url(),
    prover: z.url(),
  }),
}

/** What lives in content/challenges/<slug>/challenge.json. */
export const challengeContentSchema = z.object({
  ...challengeBase,
  status: z.never().optional(),
  gates: z.never().optional(),
  contract: contractContentSchema,
  cases: z.array(caseContentSchema).min(1),
})

/** The joined challenge the UI renders: content + imported measurements. */
export const challengeSchema = z.object({
  ...challengeBase,
  contract: contractContentSchema.extend(contractImportedSchema.shape),
  cases: z.array(caseSchema).min(1),
})

export const caseResultSchema = z.object({
  caseId: z.string(),
  /** Median paired ratio candidate / baseline. Lower is better. */
  timeRatio: z.number().positive(),
  memoryRatio: z.number().positive(),
})

/** A ranked scorecard derived from a signed judge receipt. */
export const scorecardSchema = z.object({
  id: z.string().min(1),
  submittedAt: z.iso.datetime(),
  authors: z.array(authorSchema).min(1),
  /** Model or harness that assisted the submission, if any. */
  model: z.string().nullable(),
  title: z.string().min(1),
  notes: z.string(),
  commit: sha(40),
  patchSha256: sha(64),
  repositoryUrl: z.url(),
  prNumber: z.number().int().positive(),
  prUrl: z.url(),
  receiptSha256: sha(64),
  receiptKeyId: sha(64),
  /** Signed judge aggregates include private holdouts; public per-case rows do not. */
  rTime: z.number().positive(),
  rMemory: z.number().positive(),
  tracks: z.record(
    trackIdSchema,
    z.object({
      eligible: z.boolean(),
      score: z.number().positive().nullable(),
      promotableAgainstBaseline: z.boolean(),
    }),
  ),
  promotedTracks: z.array(trackIdSchema),
  perCase: z.array(caseResultSchema).min(1),
})

/** Reviewed PR research. These rows are never judge-signed leaderboard entries. */
export const researchReviewSchema = z.object({
  prNumber: z.number().int().positive(),
  title: z.string().min(1),
  headSha: sha(40),
  patchSha256: sha(64),
  evidenceSha256: sha(64),
  reviewState: z.enum(["changes_requested", "research_only", "ready_to_judge", "promoted_direct"]),
  publicSamplesPerArm: z.number().int().nonnegative(),
  submissionId: z.string().nullable(),
  qualification: z.string(),
  validation: z.string().min(1),
  decision: z.string().min(1),
})

/** Direct public-run measurements, with their original timing scopes. */
export const researchCaseSchema = z.object({
  prNumber: z.number().int().positive(),
  headSha: sha(40),
  patchSha256: sha(64),
  evidenceSha256: sha(64),
  caseId: z.string().min(1),
  family: familyIdSchema,
  qualification: z.string(),
  samplesPerArm: z.number().int().positive(),
  timeScope: z.literal("external_command"),
  proofScope: z.enum(["", "cairo_execute_finish", "circuit_resident"]),
  baselineCommandS: z.number().positive(),
  candidateCommandS: z.number().positive(),
  medianPairedCommandRatio: z.number().positive().nullable(),
  baselineProofS: z.number().positive().nullable(),
  candidateProofS: z.number().positive().nullable(),
  baselineIngressS: z.number().positive().nullable(),
  candidateIngressS: z.number().positive().nullable(),
  baselinePeakGiBRounded: z.number().positive(),
  candidatePeakGiBRounded: z.number().positive(),
})

/** Platform-level content: the landing page and shell, independent of any one challenge. */
export const siteSchema = z.object({
  name: z.string(),
  site: z.string(),
  tagline: z.string(),
  summary: z.string(),
  featuredChallenge: z.string(),
  howItWorks: z.array(stepSchema).min(1),
  participate: z.array(stepSchema).min(1),
  faq: z.array(faqSchema),
})

export type Author = z.infer<typeof authorSchema>
export type Step = z.infer<typeof stepSchema>
export type Faq = z.infer<typeof faqSchema>
export type TrackId = z.infer<typeof trackIdSchema>
export type FamilyId = z.infer<typeof familyIdSchema>
export type StageId = z.infer<typeof stageIdSchema>
export type Stage = z.infer<typeof stageSchema>
export type Guard = z.infer<typeof guardSchema>
export type Track = z.infer<typeof trackSchema>
export type Family = z.infer<typeof familySchema>
export type Case = z.infer<typeof caseSchema>
export type Tier = z.infer<typeof tierSchema>
export type Gate = z.infer<typeof gateSchema>
export type Challenge = z.infer<typeof challengeSchema>
export type CaseResult = z.infer<typeof caseResultSchema>
export type Scorecard = z.infer<typeof scorecardSchema>
export type ResearchReview = z.infer<typeof researchReviewSchema>
export type ResearchCase = z.infer<typeof researchCaseSchema>
export type Site = z.infer<typeof siteSchema>
