import { z } from "zod"

import {
  caseMeasuredSchema,
  contractImportedSchema,
  researchCaseSchema,
  proofProgressSchema,
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
  ingressStudy: sourcePath,
  scorecards: sourcePath,
  /** Proof-only, multi-backend epoch. Optional while the repository stages it. */
  proofBenchmark: sourcePath.optional(),
  proofFixture: sourcePath.optional(),
  proofObservations: z.array(sourcePath).optional(),
  /** Per-backend PR research tables (reported proof-stage times, unranked). */
  proofResearchObservations: z.array(sourcePath).optional(),
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
    const [header = "", ...lines] = get(relative).trim().replace(/\r\n?/g, "\n").split("\n")
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
    backend: "cuda",
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
        source: "H200 direct qualification",
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
  const researchRows = readTsv(sources.research)
  const researchCases = researchCaseSchema.array().parse(
    researchRows
      .filter(
        (row) =>
          row["record_kind"] === undefined ||
          row["record_kind"] === "" ||
          row["record_kind"] === "submission",
      )
      .map((row) => ({
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
  const publicPieIds = new Set(
    fixture.cases.filter((item) => item.family === "pie").map((item) => item.id),
  )
  const proofProgress = proofProgressSchema.array().parse(
    researchRows.flatMap((row) => {
      if (
        row["family"] !== "pie" ||
        row["candidate_proof_s"] === undefined ||
        row["candidate_proof_s"] === ""
      )
        return []
      const kind =
        row["record_kind"] === undefined || row["record_kind"] === ""
          ? "submission"
          : row["record_kind"]
      return [
        {
          caseId: row["case_id"] ?? "",
          kind,
          milestone:
            row["milestone"] === undefined || row["milestone"] === ""
              ? `PR #${row["pr_number"] ?? ""}`
              : row["milestone"],
          order: num(row["timeline_order"]) ?? 100 + required(row["pr_number"], "proof pr_number"),
          proofS: required(row["candidate_proof_s"], "candidate_proof_s"),
          lowS: num(row["estimate_low_s"]),
          highS: num(row["estimate_high_s"]),
          method: row["estimate_method"] ?? "",
          sourceReceipts: row["source_receipts"] ?? "",
          prNumber: num(row["pr_number"]),
        },
      ]
    }),
  )
  for (const row of proofProgress) {
    if (!publicPieIds.has(row.caseId)) throw new Error(`Unknown proof-progress PIE: ${row.caseId}`)
  }
  const progressGroups = new Map<string, typeof proofProgress>()
  for (const row of proofProgress) {
    const key = `${String(row.order)}:${row.kind}:${row.milestone}`
    progressGroups.set(key, [...(progressGroups.get(key) ?? []), row])
  }
  for (const [key, rows] of progressGroups) {
    if (
      rows.length !== publicPieIds.size ||
      new Set(rows.map((row) => row.caseId)).size !== publicPieIds.size
    )
      throw new Error(`Incomplete six-PIE proof progress point: ${key}`)
  }
  const ingressStudy = z
    .array(
      z.object({
        cohort: z.enum(["two-distinct", "four-distinct"]),
        variant: z.enum(["baseline", "candidate"]),
        samples: z.number().int().positive(),
        pieCount: z.number().int().positive(),
        meanCommandS: z.number().positive(),
        meanIngressS: z.number().positive(),
        peakDeviceBytes: z.number().positive(),
        binarySha256: z.string().regex(/^[a-f0-9]{64}$/),
        receiptSha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .parse(
      readTsv(sources.ingressStudy).map((row) => ({
        cohort: row["cohort"],
        variant: row["variant"],
        samples: required(row["samples"], "ingress samples"),
        pieCount: required(row["pie_count"], "ingress pie_count"),
        meanCommandS: required(row["mean_command_wall_s"], "ingress mean_command_wall_s"),
        meanIngressS: required(row["mean_ingress_sum_s"], "ingress mean_ingress_sum_s"),
        peakDeviceBytes: required(row["peak_device_bytes"], "ingress peak_device_bytes"),
        binarySha256: row["binary_sha256"],
        receiptSha256: row["receipt_sha256"],
      })),
    )
  for (const cohort of ["two-distinct", "four-distinct"] as const) {
    const pair = ingressStudy.filter((row) => row.cohort === cohort)
    if (
      pair.length !== 2 ||
      pair[0]?.variant === pair[1]?.variant ||
      pair[0]?.pieCount !== pair[1]?.pieCount ||
      pair[0]?.samples !== pair[1]?.samples ||
      pair[0]?.receiptSha256 !== pair[1]?.receiptSha256
    )
      throw new Error(`Invalid H200 ingress A/B pair: ${cohort}`)
  }
  if (ingressStudy.length !== 4) throw new Error("Unexpected H200 ingress A/B rows")
  return { activation, contract, cases, reviews, researchCases, proofProgress, ingressStudy }
}
