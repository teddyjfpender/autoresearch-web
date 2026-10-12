import { formatNumber } from "@autoresearch/ui/lib/format"

import type {
  Instance,
  ScriptArchitecture,
  ScriptArchitectureRow,
  ScriptTrack,
} from "@/data/script/schema"

/** A bytes x opcodes x work product, e.g. "103M". */
export const formatScore = (value: number): string =>
  value >= 1e9
    ? `${formatNumber(value / 1e9, 2)}B`
    : value >= 1e6
      ? `${formatNumber(value / 1e6, value >= 1e8 ? 0 : 1)}M`
      : formatNumber(Math.round(value))

/** Honest work as a power of two, e.g. "2^45.76". */
export const formatWork = (bits: number): string => `2^${formatNumber(bits, 2)}`

/** "9,477 B · 201 ops · 2^45.76". */
export const formatCounts = (instance: Instance): string =>
  `${formatNumber(instance.bytes)} B · ${formatNumber(instance.opcodes)} ops · ${formatWork(instance.workBits)}`

export const instanceDate = (instance: Instance): string =>
  new Date(instance.unixTime * 1000).toISOString()

/** "standard/late-pools" -> "late-pools". */
export const instanceLabel = (instance: Instance): string =>
  instance.submission.replace(/^[a-z0-9-]+\//, "")

const least = (
  instances: readonly Instance[],
  key: (instance: Instance) => number,
): Instance | null =>
  instances.reduce<Instance | null>(
    (lowest, instance) =>
      lowest === null ||
      key(instance) < key(lowest) ||
      (key(instance) === key(lowest) && instance.score < lowest.score)
        ? instance
        : lowest,
    null,
  )

const AXES = ["bytes", "opcodes", "workBits"] as const

/** Instances no other matches or beats on bytes, opcodes and work together. */
function paretoFront(instances: readonly Instance[]): Instance[] {
  return instances.filter(
    (candidate) =>
      !instances.some(
        (other) =>
          other !== candidate &&
          AXES.every((axis) => other[axis] <= candidate[axis]) &&
          (AXES.some((axis) => other[axis] < candidate[axis]) ||
            other.unixTime < candidate.unixTime),
      ),
  )
}

/** The views a track's page shows, derived from its instances alone. */
export function boardOf(
  instances: readonly Instance[],
  registry: readonly ScriptArchitecture[],
  baselineSubmission: string | null,
): Pick<ScriptTrack, "best" | "baseline" | "architectures" | "front" | "history"> {
  const baseline = instances.find((instance) => instance.submission === baselineSubmission) ?? null
  const architectures = registry.flatMap((entry): ScriptArchitectureRow[] => {
    const mine = instances
      .filter((instance) => instance.architecture === entry.id)
      .toSorted((a, b) => a.score - b.score)
    const elite = mine[0]
    if (elite === undefined) return []
    return [
      {
        id: entry.id,
        name: entry.name,
        parent: entry.parent ?? null,
        instances: mine,
        elite,
        fewestBytes: least(mine, (instance) => instance.bytes) ?? elite,
        fewestOpcodes: least(mine, (instance) => instance.opcodes) ?? elite,
        leastWork: least(mine, (instance) => instance.workBits) ?? elite,
      },
    ]
  })
  // Running best in time order; among instances of one moment the baseline comes first.
  const ordered = instances.toSorted((a, b) => {
    if (a.unixTime !== b.unixTime) return a.unixTime - b.unixTime
    if (a === baseline || b === baseline) return a === baseline ? -1 : 1
    return b.score - a.score
  })
  const history: Instance[] = []
  for (const instance of ordered)
    if (instance.score < (history.at(-1)?.score ?? Infinity)) history.push(instance)
  return {
    best: least(instances, (instance) => instance.score),
    baseline,
    architectures: architectures.toSorted((a, b) => a.elite.score - b.elite.score),
    front: paretoFront(instances),
    history,
  }
}

export interface ScriptSummary {
  best: Instance | null
  fewestBytes: Instance | null
  fewestOpcodes: Instance | null
  leastWork: Instance | null
  /** Share of the baseline score removed by the best instance, 0..1. */
  reduction: number | null
}

export function summarizeScripts(track: ScriptTrack): ScriptSummary {
  const { best, baseline, instances } = track
  return {
    best,
    fewestBytes: least(instances, (instance) => instance.bytes),
    fewestOpcodes: least(instances, (instance) => instance.opcodes),
    leastWork: least(instances, (instance) => instance.workBits),
    reduction: best === null || baseline === null ? null : 1 - best.score / baseline.score,
  }
}
