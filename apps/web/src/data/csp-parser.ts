import { z } from "zod"

/**
 * Parsers for the RISC-V CSP full-guest track: its staged contract
 * (benchmark-riscv-csp-v1.json) and the pinned stwo-zig CSP suite manifest.
 */

const cspBackendSchema = z
  .object({
    host: z.string(),
    product: z.string().optional(),
    editablePaths: z.array(z.string()).min(1),
  })
  .loose()

export const cspContractSchema = z
  .object({
    status: z.enum(["live", "staging", "closed"]),
    contractEpoch: z.string(),
    sourceRepository: z.url(),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    proofSuite: z.string(),
    security: z.object({ friQueries: z.number().int(), powBits: z.number().int() }),
    backends: z.partialRecord(z.enum(["cuda", "metal", "cpu"]), cspBackendSchema),
  })
  .loose()
export type CspContract = z.infer<typeof cspContractSchema>

export const cspFixtureSchema = z
  .object({
    targets: z.record(
      z.string(),
      z
        .object({
          input_size_unit: z.string(),
          cases: z.array(
            z
              .object({
                input_size: z.number().int().positive(),
                expected_cycles: z.number().int().positive(),
              })
              .loose(),
          ),
        })
        .loose(),
    ),
  })
  .loose()
export type CspFixture = z.infer<typeof cspFixtureSchema>

/** Case ids as the CSP harness names them: `target:size`, e.g. `sha256:128`. */
export const cspCaseId = (target: string, size: number) => `${target}:${String(size)}`

/** One verified full-guest proof measurement of one CSP case on one backend. */
export interface CspObservation {
  backend: "cuda" | "metal" | "cpu"
  caseId: string
  sourceCommit: string
  /** CSP proof_duration: guest execution + witness construction + proof generation. */
  proofS: number
  verifyS: number | null
  peakBytes: number | null
  samples: number
  /** ISO date the observation set was recorded, from its file name. */
  observedAt: string | null
}

const cspBackend = z.enum(["cuda", "metal", "cpu"])

/**
 * Normalize a published CSP observation table (`m5-csp-v1-YYYY-MM-DD.tsv`). Rows whose
 * outputs did not match or whose proofs were not verified are skipped, never shown.
 */
export function parseCspObservations(path: string, text: string): CspObservation[] {
  const [header = "", ...lines] = text.trim().split("\n")
  const columns = header.split("\t")
  const observedAt = /(\d{4}-\d{2}-\d{2})/.exec(path)?.[1] ?? null
  const number = (value: string | undefined) => {
    if (value === undefined || value.trim() === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return lines.flatMap((line) => {
    const cells = line.split("\t")
    const row = Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]))
    const backend = cspBackend.safeParse(row["backend"])
    const proofS = number(row["proof_duration_s"])
    if (
      !backend.success ||
      proofS === null ||
      proofS <= 0 ||
      row["output_match"] !== "true" ||
      row["proof_verified"] !== "true"
    )
      return []
    return [
      {
        backend: backend.data,
        caseId: row["case_id"] ?? "",
        sourceCommit: row["source_commit"] ?? "",
        proofS,
        verifyS: number(row["verify_s"]),
        peakBytes: number(row["peak_physical_footprint_bytes"]),
        samples: number(row["samples"]) ?? 1,
        observedAt,
      },
    ]
  })
}
