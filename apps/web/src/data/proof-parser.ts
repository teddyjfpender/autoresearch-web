import { z } from "zod"

/**
 * Parsers for the proof-only, multi-backend epoch: the staged contract
 * (benchmark-proof-v2.json), its nine-job public fixture, and direct per-backend
 * proof-stage observation tables. All inputs are optional so the site keeps working
 * while the challenge repository stages them.
 */

export const backendIdSchema = z.enum(["cuda", "metal", "cpu"])
export type BackendId = z.infer<typeof backendIdSchema>

const backendSchema = z
  .object({
    host: z.string(),
    deviceBytes: z.number().positive().optional(),
    unifiedMemoryBytes: z.number().positive().optional(),
    systemMemoryBytes: z.number().positive().optional(),
    reserveBytes: z.number().positive().optional(),
    editablePaths: z.array(z.string()).min(1),
  })
  .loose()

export const proofContractSchema = z
  .object({
    status: z.enum(["live", "staging", "closed"]),
    contractEpoch: z.string(),
    sourceRepository: z.string(),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    security: z.object({
      friQueries: z.number(),
      queryPowBits: z.number(),
      interactionPowBits: z.number(),
      preprocessedVariant: z.string(),
    }),
    backends: z.record(backendIdSchema, backendSchema),
  })
  .loose()
export type ProofContract = z.infer<typeof proofContractSchema>

export const proofFixtureSchema = z
  .object({
    contract_epoch: z.string(),
    cases: z.array(
      z
        .object({
          id: z.string(),
          family: z.enum(["pie", "recursion", "pipeline"]),
          blocks: z.tuple([z.number(), z.number()]).optional(),
          os_steps: z.number().optional(),
          inputs: z.array(z.unknown()).optional(),
        })
        .loose(),
    ),
  })
  .loose()
export type ProofFixture = z.infer<typeof proofFixtureSchema>

/** One direct proof-stage observation of one job on one backend. */
export interface ProofObservation {
  backend: BackendId
  caseId: string
  proofS: number
  /** False when the recorded interval still includes setup or static work. */
  isolated: boolean
  scope: string
  sourceCommit: string
  peakBytes: number | null
  /** ISO date the observation set was recorded, from its directory name when present. */
  observedAt: string | null
  path: string
}

const DATE_IN_PATH = /(\d{4}-\d{2}-\d{2})/

function readTsv(text: string): Record<string, string>[] {
  const [header = "", ...lines] = text.trim().split("\n")
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

/**
 * Normalize one observation table. Two published shapes exist: per-stage smoke rows
 * (`stage_total_s` + `stage_scope`) and capacity rows (`prove_s`). Rows without a backend,
 * case, or proof time are skipped rather than guessed.
 */
export function parseObservations(path: string, text: string): ProofObservation[] {
  const observedAt = DATE_IN_PATH.exec(path)?.[1] ?? null
  return readTsv(text).flatMap((row) => {
    const backend = backendIdSchema.safeParse(row["backend"])
    const caseId = row["case_id"] ?? ""
    const proofS = num(row["stage_total_s"]) ?? num(row["prove_s"])
    if (!backend.success || caseId === "" || proofS === null || proofS <= 0) return []
    const scope = row["stage_scope"] ?? (row["prove_s"] === undefined ? "" : "prove_s")
    const referenceMatch = row["reference_match"]
    if (referenceMatch !== undefined && referenceMatch !== "true") return []
    return [
      {
        backend: backend.data,
        caseId,
        proofS,
        isolated: !/includes/i.test(scope),
        scope,
        sourceCommit: row["source_commit"] ?? "",
        peakBytes: num(row["peak_physical_footprint_bytes"]),
        observedAt,
        path,
      },
    ]
  })
}

/**
 * The best available isolated observation per case for one backend: prefer rows on the
 * contract's pinned source, then the most recent observation set.
 */
export function latestObservations(
  observations: readonly ProofObservation[],
  backend: BackendId,
  pinnedCommit: string | null,
): Map<string, ProofObservation> {
  const ranked = observations
    .filter((row) => row.backend === backend)
    .toSorted((a, b) => {
      const pin = Number(b.sourceCommit === pinnedCommit) - Number(a.sourceCommit === pinnedCommit)
      const isolated = Number(b.isolated) - Number(a.isolated)
      return pin !== 0
        ? pin
        : isolated === 0
          ? (b.observedAt ?? "").localeCompare(a.observedAt ?? "")
          : isolated
    })
  const best = new Map<string, ProofObservation>()
  for (const row of ranked) {
    if (best.has(row.caseId)) continue
    best.set(row.caseId, row)
  }
  return best
}
