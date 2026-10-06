import { z } from "zod"

/**
 * Wire types of a circuit-challenge repository's site feed (`data/site/sources.json` and the
 * files it names). The feed is self-describing: units, direction and the metric's formula come
 * from the repository, not from this site.
 */
const path = z.string().regex(/^[A-Za-z0-9_./-]+$/)
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/)

export const circuitSourcesSchema = z.object({
  schema: z.literal("qac-site-sources-v1"),
  registry: path,
  activation: path,
  challenges: z.record(
    slug,
    z.object({
      benchmark: path,
      architectures: path,
      targets: path,
      ledger: path,
      leaderboard: path,
      content: path,
    }),
  ),
})

const gateSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["done", "partial", "pending"]),
  evidence: z.string(),
})

export const circuitActivationSchema = z.object({
  schema: z.literal("qac-site-activation-v1"),
  status: z.enum(["live", "staging", "closed"]),
  summary: z.string().optional(),
  gates: z.array(gateSchema),
})

const stageSchema = z.object({ engine: z.string().min(1), samples: z.number().int().positive() })

export const circuitBenchmarkSchema = z
  .object({
    schema: z.literal("qac-benchmark-v1"),
    name: slug,
    title: z.string().min(1),
    description: z.string().min(1),
    status: z.enum(["live", "staging", "closed"]),
    contractEpoch: z.string().min(1),
    metric: z.object({
      name: z.string(),
      formula: z.string(),
      components: z.array(
        z.object({ id: z.string(), name: z.string(), unit: z.string(), note: z.string() }),
      ),
    }),
    tracks: z
      .array(z.object({ name: slug, title: z.string(), spec: z.string(), description: z.string() }))
      .min(1),
    standard: z.object({ summary: z.string(), document: z.string() }).loose(),
    editablePaths: z.array(z.string()).min(1),
    validation: z.object({ screen: stageSchema, full: stageSchema }).loose(),
    acceptance: z.object({ minImprovementBips: z.number().positive(), rule: z.string() }),
  })
  .loose()

export const circuitArchitecturesSchema = z
  .object({
    schema: z.literal("qac-architectures-v1"),
    axis: z.string().optional(),
    architectures: z
      .array(
        z.object({
          id: slug,
          name: z.string().min(1),
          mechanism: z.string().min(1),
          distinguishing: z.string().min(1),
          parent: slug.optional(),
          references: z.array(z.string()),
        }),
      )
      .min(1),
  })
  .loose()

export const circuitTargetsSchema = z
  .object({
    schema: z.literal("qac-targets-v1"),
    conventions: z.string(),
    targets: z.array(
      z.object({
        id: z.string(),
        track: slug,
        label: z.string(),
        citation: z.string(),
        toffoliPublished: z.number().positive(),
        qubitsPublished: z.number().positive(),
        toffoliHarnessEquivalent: z.number().positive(),
      }),
    ),
  })
  .loose()

const circuitSchema = z.object({
  unixTime: z.number().int().positive(),
  track: slug,
  architecture: slug,
  toffoli: z.number().positive(),
  qubits: z.number().int().positive(),
  toffoliTimesQubits: z.number().positive(),
  score: z.number().positive(),
  samples: z.number().int().positive(),
  engine: z.string(),
  opsSha256: sha256,
  verifierSha256: sha256,
  commit: z.string(),
  pr: z.number().int().positive().nullable(),
  author: z.string().nullable(),
  model: z.string().nullable(),
  harness: z.string().nullable(),
  submission: z.string(),
  kind: z.enum(["historical", "submission"]),
  standing: z.array(z.string()),
  note: z.string(),
})

export const circuitLeaderboardSchema = z.object({
  schema: z.literal("qac-leaderboard-v1"),
  challenge: slug,
  ledger: path,
  ledgerRows: z.number().int().nonnegative(),
  tracks: z.array(
    z.object({
      track: slug,
      title: z.string(),
      spec: z.string(),
      circuits: z.number().int().nonnegative(),
      best: circuitSchema.nullable(),
      architectures: z.array(
        z.object({
          id: slug,
          name: z.string(),
          parent: slug.nullish(),
          circuits: z.number().int().positive(),
          firstUnixTime: z.number().int().positive(),
          elite: circuitSchema,
          fewestQubits: circuitSchema,
          fewestToffoli: circuitSchema,
          history: z.array(circuitSchema),
        }),
      ),
      front: z.array(circuitSchema),
      history: z.array(circuitSchema),
    }),
  ),
})

const stepSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  command: z.string().optional(),
})

export const circuitContentSchema = z.object({
  schema: z.literal("qac-site-content-v1"),
  id: slug,
  name: z.string().min(1),
  group: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  metric: z.object({
    label: z.string(),
    direction: z.literal("lower-is-better"),
    axes: z.array(z.object({ id: z.string(), label: z.string(), unit: z.string() })),
  }),
  tracks: z.array(
    z.object({ id: slug, name: z.string(), headline: z.string(), summary: z.string() }),
  ),
  levels: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
  standard: z.string(),
  rules: z.array(z.string()).min(1),
  participate: z.array(stepSchema).min(1),
  agentPrompt: z.string().min(1),
  links: z.object({ repo: z.url(), discussions: z.url(), task: z.url() }),
})

export type Circuit = z.infer<typeof circuitSchema>
export type CircuitGate = z.infer<typeof gateSchema>
export type CircuitArchitecture = z.infer<
  typeof circuitArchitecturesSchema
>["architectures"][number]
export type CircuitTarget = z.infer<typeof circuitTargetsSchema>["targets"][number]
export type CircuitTrackBoard = z.infer<typeof circuitLeaderboardSchema>["tracks"][number]
export type CircuitContent = z.infer<typeof circuitContentSchema>
export type CircuitBenchmark = z.infer<typeof circuitBenchmarkSchema>

/** One route: a track of a circuit challenge, with everything its page renders. */
export interface CircuitChallenge {
  kind: "circuit"
  slug: string
  challengeId: string
  trackId: string
  /** "FeMoco walk step · Reiher". */
  name: string
  trackName: string
  group: string
  headline: string
  summary: string
  status: "live" | "staging" | "closed"
  gates: CircuitGate[]
  content: CircuitContent
  benchmark: CircuitBenchmark
  board: CircuitTrackBoard
  /** Every recorded circuit of the track, oldest first. */
  circuits: Circuit[]
  architectures: CircuitArchitecture[]
  targets: CircuitTarget[]
  targetConventions: string
  siblings: { slug: string; id: string; name: string }[]
  links: CircuitContent["links"]
  repositoryCommit: string
  repositoryDate: string
  agentPrompt: string
}
