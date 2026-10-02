import type { Case, Challenge, FamilyId, Scorecard, TrackId } from "@/data/schema"

/**
 * Client-side mirror of the judge scorer (harness/score.py). Each family gets one third of
 * the log-weight, split equally among its cases; R_T and R_M are weighted geometric means
 * of per-case ratios; track scores are "higher is better, baseline = 1".
 */

export const TRACK_IDS: readonly TrackId[] = ["latency", "memory", "balanced"]

const LATENCY_MEMORY_GUARD = 1.1
const CASE_TIME_GUARD = 1.5
const CASE_MEMORY_GUARD = 1.5
const AGGREGATE_TIME_GUARD = 1.25

export function caseWeights(cases: readonly Case[]): Map<string, number> {
  const perFamily = new Map<FamilyId, number>()
  for (const testCase of cases) {
    perFamily.set(testCase.family, (perFamily.get(testCase.family) ?? 0) + 1)
  }
  const families = perFamily.size
  return new Map(
    cases.map((testCase) => [testCase.id, 1 / families / (perFamily.get(testCase.family) ?? 1)]),
  )
}

export interface TrackResult {
  eligible: boolean
  score: number | null
  /** Human-readable guard failures, empty when eligible. */
  failures: string[]
}

export interface Scored {
  card: Scorecard
  rTime: number
  rMemory: number
  tracks: Record<TrackId, TrackResult>
}

export function scoreCard(card: Scorecard, cases: readonly Case[]): Scored {
  const weights = caseWeights(cases)
  let logTime = 0
  let logMemory = 0
  for (const result of card.perCase) {
    const weight = weights.get(result.caseId) ?? 0
    logTime += weight * Math.log(result.timeRatio)
    logMemory += weight * Math.log(result.memoryRatio)
  }
  const rTime = Math.exp(logTime)
  const rMemory = Math.exp(logMemory)

  const over = (key: "timeRatio" | "memoryRatio", limit: number, label: string) =>
    card.perCase
      .filter((result) => result[key] > limit)
      .map((result) => `${result.caseId} ${label} ${result[key].toFixed(3)} > ${limit.toFixed(2)}`)
  const aggregateTime =
    rTime > AGGREGATE_TIME_GUARD
      ? [`R_T ${rTime.toFixed(3)} > ${AGGREGATE_TIME_GUARD.toFixed(2)}`]
      : []

  const latencyFailures = over("memoryRatio", LATENCY_MEMORY_GUARD, "M/M₀")
  const memoryFailures = [...over("timeRatio", CASE_TIME_GUARD, "T/T₀"), ...aggregateTime]
  const balancedFailures = [
    ...over("timeRatio", CASE_TIME_GUARD, "T/T₀"),
    ...over("memoryRatio", CASE_MEMORY_GUARD, "M/M₀"),
    ...aggregateTime,
  ]
  const track = (failures: string[], score: number): TrackResult => ({
    eligible: failures.length === 0,
    score: failures.length === 0 ? score : null,
    failures,
  })

  return {
    card,
    rTime,
    rMemory,
    tracks: {
      latency: track(latencyFailures, 1 / rTime),
      memory: track(memoryFailures, 1 / rMemory),
      balanced: track(balancedFailures, 1 / Math.sqrt(rTime * rMemory)),
    },
  }
}

export interface Promotion {
  scored: Scored
  score: number
  /** Leader score this promotion beat (1 = baseline). */
  previous: number
  /** 1-based, 1 = current leader. */
  rank: number
}

/**
 * Chronological leader progression for a track: an eligible scorecard is promoted when it
 * beats the standing leader (initially the baseline, 1.0) by at least `minImprovement`.
 * Returned newest first.
 */
export function promotions(
  scored: readonly Scored[],
  track: TrackId,
  minImprovement: number,
): Promotion[] {
  const out: Omit<Promotion, "rank">[] = []
  let leader = 1
  for (const entry of scored) {
    const score = entry.tracks[track].score
    if (score === null || score < leader * (1 + minImprovement)) continue
    out.push({ scored: entry, score, previous: leader })
    leader = score
  }
  return out.toReversed().map((promotion, index) => ({ ...promotion, rank: index + 1 }))
}

export interface FrontierPoint {
  scored: Scored
  pareto: boolean
}

/** Non-dominated (R_T, R_M) points across judged scorecards, sorted by R_M. */
export function paretoFrontier(scored: readonly Scored[]): Scored[] {
  return scored
    .filter(
      (point) =>
        !scored.some(
          (other) =>
            other !== point &&
            other.rTime <= point.rTime &&
            other.rMemory <= point.rMemory &&
            (other.rTime < point.rTime || other.rMemory < point.rMemory),
        ),
    )
    .toSorted((a, b) => a.rMemory - b.rMemory)
}

export interface Summary {
  scored: Scored[]
  leaders: Record<TrackId, Promotion | undefined>
  promotions: Record<TrackId, Promotion[]>
  frontier: Scored[]
  ranked: number
}

export function summarize(challenge: Challenge, cards: readonly Scorecard[]): Summary {
  const scored = cards.map((card) => scoreCard(card, challenge.cases))
  const byTrack = Object.fromEntries(
    TRACK_IDS.map((track) => [track, promotions(scored, track, challenge.contract.minImprovement)]),
  ) as Record<TrackId, Promotion[]>
  return {
    scored,
    promotions: byTrack,
    leaders: {
      latency: byTrack.latency[0],
      memory: byTrack.memory[0],
      balanced: byTrack.balanced[0],
    },
    frontier: paretoFrontier(scored),
    ranked: scored.length,
  }
}
