import { z } from "zod"

/**
 * Wire types of a script-challenge repository's site feed (`data/site/sources.json` and the
 * files it names). The feed is self-describing: units, direction and the metric's formula come
 * from the repository, not from this site. Its format is that repository's `spec/WEBSITE.md`.
 */
const path = z.string().regex(/^[A-Za-z0-9_./-]+$/)
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/)
const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .transform(Number)

export const scriptSourcesSchema = z.object({
  schema: z.literal("bac-site-sources-v1"),
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
      startingBoard: path.optional(),
    }),
  ),
})

const gateSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["done", "partial", "pending"]),
  evidence: z.string(),
})

export const scriptActivationSchema = z.object({
  schema: z.literal("bac-site-activation-v1"),
  status: z.enum(["live", "staging", "closed"]),
  summary: z.string().optional(),
  gates: z.array(gateSchema),
})

const stageSchema = z.object({ engine: z.string().min(1), lanes: z.number().int().positive() })
const componentSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  note: z.string(),
})

export const scriptBenchmarkSchema = z
  .object({
    schema: z.literal("bac-benchmark-v1"),
    name: slug,
    title: z.string().min(1),
    description: z.string().min(1),
    status: z.enum(["live", "staging", "closed"]),
    contractEpoch: z.string().min(1),
    metric: z.object({
      name: z.string(),
      formula: z.string(),
      components: z.array(componentSchema),
      /** The quantity every track holds fixed and the score does not reward. */
      fixed: componentSchema,
    }),
    tracks: z
      .array(
        z.object({
          name: slug,
          title: z.string(),
          spec: z.string(),
          description: z.string(),
          standard: z.object({ model: z.string(), workModel: z.string(), floorBits: decimal }),
        }),
      )
      .min(1),
    standard: z.object({ summary: z.string(), document: z.string() }).loose(),
    editablePaths: z.array(z.string()).min(1),
    validation: z.object({ screen: stageSchema, full: stageSchema }).loose(),
    acceptance: z.object({ minImprovementBips: z.number().positive(), rule: z.string() }),
  })
  .loose()

export const scriptArchitecturesSchema = z
  .object({
    schema: z.literal("bac-architectures-v1"),
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

export const scriptTargetsSchema = z
  .object({
    schema: z.literal("bac-targets-v1"),
    conventions: z.string(),
    targets: z.array(
      z
        .object({
          id: z.string(),
          track: slug,
          label: z.string(),
          citation: z.string(),
          opcodesPublished: z.number().positive(),
          lockingBytesPublished: z.number().positive(),
          honestWorkBitsPublished: z.number().positive(),
          collisionBitsPublished: z.number().positive(),
        })
        .loose(),
    ),
  })
  .loose()

export const scriptLeaderboardSchema = z
  .object({
    schema: z.literal("bac-leaderboard-v1"),
    challenge: slug,
    ledger: path,
    ledgerRows: z.number().int().nonnegative(),
    tracks: z.array(
      z
        .object({
          track: slug,
          title: z.string(),
          spec: z.string(),
          securityFloorBits: z.number().positive(),
          /** The track's baseline as a ledger row; null until the judge has recorded it. */
          baseline: z.object({ submission: z.string() }).loose().nullable(),
        })
        .loose(),
    ),
  })
  .loose()

/** The instances a board starts from, measured on public lanes and not yet ledger rows. */
export const scriptStartingBoardSchema = z
  .object({
    schema: z.literal("bac-starting-board-v1"),
    candidates: z.array(
      z
        .object({
          id: z.string(),
          track: slug,
          role: z.string(),
          submission: z.string(),
          instanceSha256: sha256,
          local: z.object({
            bytes: z.number().int().positive(),
            opcodes: z.number().int().positive(),
            workBits: decimal,
            score: decimal,
            securityBits: decimal,
            lanes: z.number().int().positive(),
            engine: z.string(),
            verifierSha256: sha256,
          }),
        })
        .loose(),
    ),
  })
  .loose()

/** `submission.json` of a starting-board instance: who made it and what it is. */
export const scriptManifestSchema = z
  .object({
    architecture: slug,
    title: z.string(),
    authors: z.array(z.string()).min(1),
    model: z.string(),
    harness: z.string(),
  })
  .loose()

const stepSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  command: z.string().optional(),
})
const axisSchema = z.object({ id: z.string(), label: z.string(), unit: z.string() })

export const scriptContentSchema = z.object({
  schema: z.literal("bac-site-content-v1"),
  id: slug,
  name: z.string().min(1),
  group: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  metric: z.object({
    label: z.string(),
    direction: z.literal("lower-is-better"),
    axes: z.array(axisSchema),
    fixed: axisSchema,
  }),
  tracks: z.array(
    z.object({ id: slug, name: z.string(), headline: z.string(), summary: z.string() }),
  ),
  levels: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
  standard: z.string(),
  rules: z.array(z.string()).min(1),
  /** What the tracks' baseline is, in a sentence. */
  baseline: z.string().optional(),
  participate: z.array(stepSchema).min(1),
  agentPrompt: z.string().min(1),
  links: z.object({
    repo: z.url(),
    discussions: z.url(),
    task: z.url(),
    paper: z.url().optional(),
  }),
})

export type ScriptGate = z.infer<typeof gateSchema>
export type ScriptArchitecture = z.infer<typeof scriptArchitecturesSchema>["architectures"][number]
export type ScriptTarget = z.infer<typeof scriptTargetsSchema>["targets"][number]
export type ScriptContent = z.infer<typeof scriptContentSchema>
export type ScriptBenchmark = z.infer<typeof scriptBenchmarkSchema>

/** One validated script instance: a ledger row, or a starting-board measurement. */
export interface Instance {
  unixTime: number
  track: string
  architecture: string
  /** Locking script plus the largest honest unlocking script. */
  bytes: number
  /** The interpreter's operation count on an honest spend; consensus allows 201. */
  opcodes: number
  /** log2 of the expected SHA-256 compressions for one honest spend. */
  workBits: number
  score: number
  securityBits: number
  lanes: number
  engine: string
  instanceSha256: string
  verifierSha256: string
  pr: number | null
  author: string | null
  model: string | null
  harness: string | null
  /** `<track>/<id>` of the submission directory. */
  submission: string
  note: string
  /** Measured on public lanes for the starting board; not a signed ledger row. */
  provisional: boolean
}

/** One architecture's standing on a track. */
export interface ScriptArchitectureRow {
  id: string
  name: string
  parent: string | null
  /** Every instance of the architecture, best score first. */
  instances: Instance[]
  elite: Instance
  fewestBytes: Instance
  fewestOpcodes: Instance
  leastWork: Instance
}

/** One track of a script challenge: its instances and the views the page shows. */
export interface ScriptTrack {
  id: string
  name: string
  headline: string
  summary: string
  spec: string
  model: string
  floorBits: number
  /** Every instance of the track, oldest first. */
  instances: Instance[]
  /** True while the judge has recorded nothing and the starting board stands in. */
  provisional: boolean
  best: Instance | null
  baseline: Instance | null
  architectures: ScriptArchitectureRow[]
  /** Instances no other matches or beats on bytes, opcodes and work together. */
  front: Instance[]
  /** Instances that lowered the track's best score, in time order. */
  history: Instance[]
  targets: ScriptTarget[]
}

/** One route: a script challenge with all of its tracks. */
export interface ScriptChallenge {
  kind: "script"
  slug: string
  name: string
  group: string
  headline: string
  summary: string
  status: "live" | "staging" | "closed"
  gates: ScriptGate[]
  content: ScriptContent
  benchmark: ScriptBenchmark
  tracks: ScriptTrack[]
  architectures: ScriptArchitecture[]
  targetConventions: string
  links: ScriptContent["links"]
  repositoryCommit: string
  repositoryDate: string
  agentPrompt: string
}
