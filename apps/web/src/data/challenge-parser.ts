import { z } from "zod"

import {
  caseMeasuredSchema,
  contractImportedSchema,
  researchCaseSchema,
  researchReviewSchema,
  gateSchema,
} from "./schema"

/** Exact public files read from one immutable GitHub commit. */
const sourcePath = z
  .string()
  .regex(/^[A-Za-z0-9_./-]+$/)
  .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."))
export const challengeSourceManifestSchema = z.object({
  schema: z.literal("stwo-cuda-site-sources-v1"),
  activation: sourcePath,
  benchmark: sourcePath,
  fixture: sourcePath,
  report: sourcePath,
  summary: sourcePath,
  runs: sourcePath,
  reviews: sourcePath,
  research: sourcePath,
  scorecards: sourcePath,
})
export type ChallengeSourceManifest = z.infer<typeof challengeSourceManifestSchema>

/** Shared by the local importer and the live GitHub data adapter. */
export function parseChallengeFiles(
  files: Readonly<Record<string, string>>,
  sources: ChallengeSourceManifest,
) {
  const get = (relative: string): string => {
    const value = files[relative]
    if (value === undefined) throw new Error(`Missing challenge source file: ${relative}`)
    return value
  }
  const readJson = (relative: string): unknown => JSON.parse(get(relative))
  const activation = z
    .object({
      schema: z.literal("stwo-cuda-site-activation-v1"),
      status: z.enum(["live", "staging", "closed"]),
      gates: z.array(gateSchema),
    })
    .parse(readJson(sources.activation))
  const readTsv = (relative: string): Record<string, string>[] => {
    const [header = "", ...lines] = get(relative).trim().split("\n")
    const columns = header.split("\t")
    return lines.map((line) => {
      const cells = line.split("\t")
      return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]))
    })
  }
  const num = (value: string | undefined): number | null => {
    if (value === undefined || value.trim() === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const required = (value: string | undefined, label: string): number => {
    const parsed = num(value)
    if (parsed === null) throw new Error(`Missing ${label}`)
    return parsed
  }
  const round = (value: number, digits = 4) => Number(value.toFixed(digits))

  // --- contract (benchmark.json) -------------------------------------------------------------

  const benchmark = z
    .object({
      contractEpoch: z.string(),
      sourceRepository: z.string(),
      sourceCommit: z.string(),
      editablePaths: z.array(z.string()),
      hardware: z.object({ gpu: z.string(), deviceBytes: z.number(), reserveBytes: z.number() }),
      security: z.object({
        friQueries: z.number(),
        queryPowBits: z.number(),
        interactionPowBits: z.number(),
        preprocessedVariant: z.string(),
      }),
    })
    .parse(readJson(sources.benchmark))

  const reportMeta = z
    .object({ date_utc: z.string(), qualification: z.string(), source_commit: z.string() })
    .parse(readJson(sources.report))
  if (reportMeta.source_commit !== benchmark.sourceCommit)
    throw new Error("H200 baseline report does not match the pinned source commit")

  const contract = contractImportedSchema.parse({
    ...benchmark,
    baselineMeasuredAt: reportMeta.date_utc,
    baselineQualification: reportMeta.qualification,
    sourceRepository: benchmark.sourceRepository.replace(/\.git$/, ""),
  })

  // --- cases (fixture manifest + H200 qualification) -------------------------------------------

  const fixture = z
    .object({
      cases: z.array(
        z
          .object({
            id: z.string(),
            family: z.enum(["pie", "recursion", "pipeline"]),
            blocks: z.tuple([z.number(), z.number()]).optional(),
            os_steps: z.number().optional(),
            mode: z.enum(["serial", "batch_integrated"]).optional(),
            inputs: z.array(z.unknown()).optional(),
          })
          .loose(),
      ),
    })
    .parse(readJson(sources.fixture))

  const report = z
    .object({
      rounds: z.array(
        z.object({
          cases: z.array(
            z.object({ case_id: z.string(), planned_arena_bytes: z.number() }).loose(),
          ),
        }),
      ),
    })
    .parse(readJson(sources.report))

  const summary = new Map(readTsv(sources.summary).map((row) => [row["case_id"] ?? "", row]))
  const runs = readTsv(sources.runs)

  const cases = fixture.cases.map((testCase) => {
    const median = summary.get(testCase.id)
    if (!median) throw new Error(`No H200 summary row for ${testCase.id}`)
    const arenas = report.rounds.flatMap((reportRound) =>
      reportRound.cases
        .filter((row) => row.case_id === testCase.id)
        .map((row) => row.planned_arena_bytes),
    )
    if (arenas.length === 0) throw new Error(`No planned arena for ${testCase.id}`)
    const proofTimeS = num(median["proof_stage_s"])
    const runProofTimesS = runs
      .filter((row) => row["case_id"] === testCase.id)
      .flatMap((row) => {
        const value = num(row["proof_stage_s"])
        return value === null ? [] : [round(value)]
      })
    const fold = num(median["fold_stage_s"])
    const leafSum = num(median["cairo_leaf_proof_sum_s"])
    const proofTimeScope =
      proofTimeS !== null
        ? "CUDA proof execute → proof.finish"
        : fold !== null
          ? `Pending: the ${fold.toFixed(2)} s fold stage includes host construction; resident proof timers weren't retained`
          : leafSum !== null
            ? `Pending: Cairo leaf proofs took ${leafSum.toFixed(2)} s; wrap and fold proof times weren't retained`
            : "Pending: no proof-stage timer was retained"
    const ingressS = num(median["ingress_s"])
    return caseMeasuredSchema.parse({
      id: testCase.id,
      family: testCase.family,
      ...(testCase.blocks ? { blocks: testCase.blocks } : {}),
      ...(testCase.os_steps === undefined ? {} : { osSteps: testCase.os_steps }),
      ...(testCase.family === "pie" || testCase.inputs === undefined
        ? {}
        : { leaves: testCase.inputs.length }),
      ...(testCase.mode === undefined ? {} : { mode: testCase.mode }),
      baseline: {
        proofTimeS: proofTimeS === null ? null : round(proofTimeS),
        runProofTimesS,
        proofTimeScope,
        arenaBytes: Math.max(...arenas),
        commandTimeS: round(required(median["process_s"], `${testCase.id} process_s`)),
        ...(ingressS === null ? {} : { ingressS: round(ingressS) }),
        peakBytes: required(median["peak_device_bytes"], `${testCase.id} peak_device_bytes`),
        rounds: report.rounds.length,
      },
    })
  })

  // --- reviewed, unranked PR research ---------------------------------------------------------

  const reviews = researchReviewSchema.array().parse(
    readTsv(sources.reviews).map((row) => ({
      prNumber: required(row["pr_number"], "review pr_number"),
      title: row["title"] ?? "",
      headSha: row["head_sha"] ?? "",
      patchSha256: row["patch_sha256"] ?? "",
      evidenceSha256: row["evidence_sha256"] ?? "",
      reviewState: row["review_state"] ?? "",
      publicSamplesPerArm: required(row["public_samples_per_arm"], "public_samples_per_arm"),
      submissionId: row["submission_id"] === "" ? null : (row["submission_id"] ?? null),
      qualification: row["qualification"] ?? "",
      validation: row["validation"] ?? "",
      decision: row["decision"] ?? "",
    })),
  )
  const researchCases = researchCaseSchema.array().parse(
    readTsv(sources.research).map((row) => ({
      prNumber: required(row["pr_number"], "research pr_number"),
      headSha: row["head_sha"] ?? "",
      patchSha256: row["patch_sha256"] ?? "",
      evidenceSha256: row["evidence_sha256"] ?? "",
      caseId: row["case_id"] ?? "",
      family: row["family"] ?? "",
      qualification: row["qualification"] ?? "",
      samplesPerArm: required(row["samples_per_arm"], "samples_per_arm"),
      timeScope: row["time_scope"] ?? "",
      proofScope: row["proof_scope"] ?? "",
      baselineCommandS: required(row["baseline_command_s"], "baseline_command_s"),
      candidateCommandS: required(row["candidate_command_s"], "candidate_command_s"),
      medianPairedCommandRatio: num(row["median_paired_command_ratio"]),
      baselineProofS: num(row["baseline_proof_s"]),
      candidateProofS: num(row["candidate_proof_s"]),
      baselineIngressS: num(row["baseline_ingress_s"]),
      candidateIngressS: num(row["candidate_ingress_s"]),
      baselinePeakGiBRounded: required(
        row["baseline_peak_gib_rounded"],
        "baseline_peak_gib_rounded",
      ),
      candidatePeakGiBRounded: required(
        row["candidate_peak_gib_rounded"],
        "candidate_peak_gib_rounded",
      ),
    })),
  )
  const reviewIds = new Set(reviews.map((review) => review.prNumber))
  if (reviewIds.size !== reviews.length) throw new Error("Duplicate reviewed PR")
  const researchIds = new Set(researchCases.map((row) => `${String(row.prNumber)}:${row.caseId}`))
  if (researchIds.size !== researchCases.length) throw new Error("Duplicate research case")
  for (const row of researchCases) {
    const review = reviews.find((item) => item.prNumber === row.prNumber)
    if (
      review?.headSha !== row.headSha ||
      review.patchSha256 !== row.patchSha256 ||
      review.evidenceSha256 !== row.evidenceSha256 ||
      !fixture.cases.some((item) => item.id === row.caseId)
    )
      throw new Error(`Research row is not bound to a reviewed PR and public case: ${row.caseId}`)
  }
  return { activation, contract, cases, reviews, researchCases }
}
