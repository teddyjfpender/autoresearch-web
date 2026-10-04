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
