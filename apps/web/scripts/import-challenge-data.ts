/**
 * Imports the Stwo CUDA challenge's measured data and contract from its repository.
 *
 *   bun run data:import [path/to/stwo-cuda-challenge]
 *
 * Defaults to a sibling checkout. Writes validated JSON to src/data/imported/stwo-cuda/:
 *   contract.json   pinned source, editable paths, hardware, security   (benchmark.json)
 *   cases.json      per-case shape + H200 baseline measurements         (fixture + reports)
 *   research-reviews.json  frozen PR reviews, not ranked receipts       (review TSV)
 *   research-cases.json    direct, unranked PR measurements             (research TSV)
 * scorecards.json is left alone: it holds judge-signed rank results once intake is live.
 * Source hashes and machine-local paths are dropped.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { z } from "zod"

import {
  caseMeasuredSchema,
  contractImportedSchema,
  researchCaseSchema,
  researchReviewSchema,
} from "../src/data/schema"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const repo = resolve(process.argv[2] ?? here("../../../../stwo-cuda-challenge"))
const out = (name: string) => here(`../src/data/imported/stwo-cuda/${name}`)

const FILES = {
  benchmark: "benchmark.json",
  fixture: "fixtures/public-v1.json",
  report: "data/reports/h200-direct-2026-10-02.json",
  summary: "data/reports/h200-direct-2026-10-02-summary.tsv",
  runs: "data/reports/h200-direct-2026-10-02-runs.tsv",
  reviews: "data/reports/submission-review-2026-10-02.tsv",
  research: "data/reports/submission-research-2026-10-02.tsv",
} as const

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(resolve(repo, relative), "utf8"))

function readTsv(relative: string): Record<string, string>[] {
  const [header = "", ...lines] = readFileSync(resolve(repo, relative), "utf8").trim().split("\n")
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
const write = (name: string, value: unknown) => {
  writeFileSync(out(name), `${JSON.stringify(value, null, 2)}\n`)
}

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
  .parse(readJson(FILES.benchmark))

const reportMeta = z
  .object({ date_utc: z.string(), qualification: z.string() })
  .parse(readJson(FILES.report))

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
  .parse(readJson(FILES.fixture))

const report = z
  .object({
    rounds: z.array(
      z.object({
        cases: z.array(z.object({ case_id: z.string(), planned_arena_bytes: z.number() }).loose()),
      }),
    ),
  })
  .parse(readJson(FILES.report))

const summary = new Map(readTsv(FILES.summary).map((row) => [row["case_id"] ?? "", row]))
const runs = readTsv(FILES.runs)

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

write("contract.json", contract)
write("cases.json", cases)

// --- reviewed, unranked PR research ---------------------------------------------------------

const reviews = researchReviewSchema.array().parse(
  readTsv(FILES.reviews).map((row) => ({
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
  readTsv(FILES.research).map((row) => ({
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
    baselinePeakGiBRounded: required(row["baseline_peak_gib_rounded"], "baseline_peak_gib_rounded"),
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
write("research-reviews.json", reviews)
write("research-cases.json", researchCases)
console.log(
  `Imported contract, ${String(cases.length)} cases and ${String(reviews.length)} reviewed PRs from ${repo}`,
)
