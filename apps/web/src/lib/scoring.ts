import type { Case, Challenge, FamilyId, Scorecard, TrackId } from "@/data/schema"

/** Display the judge's signed aggregate scores, which include private holdouts. */

export const TRACK_IDS: readonly TrackId[] = ["latency", "memory", "balanced"]

/** Display-only weights from the public contract; never use them to rescore a rank receipt. */
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

export function scoreCard(card: Scorecard): Scored {
  return {
    card,
    rTime: card.rTime,
    rMemory: card.rMemory,
    tracks: {
      latency: signedTrack(card, "latency"),
      memory: signedTrack(card, "memory"),
      balanced: signedTrack(card, "balanced"),
    },
  }
}

function signedTrack(card: Scorecard, name: TrackId): TrackResult {
  const track = card.tracks[name]
  return {
    eligible: track.eligible,
    score: track.score,
    failures: track.eligible ? [] : ["Failed a signed judge guard"],
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
    if (
      score === null ||
      !entry.card.promotedTracks.includes(track) ||
      score < leader * (1 + minImprovement)
    )
      continue
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
  const scored = cards.map(scoreCard)
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
