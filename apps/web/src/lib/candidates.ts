import type { Challenge, FamilyId, ResearchCase, ResearchReview, TrackId } from "@/data/schema"
import type { ResearchItem } from "@/lib/github-research"

/**
 * Reviewed candidate PRs, derived entirely from the challenge repository's research tables
 * and live PR metadata. These are unranked direct measurements, never signed scores.
 */

export interface CandidateCase {
  caseId: string
  title: string
  family: FamilyId
  /** candidate / baseline proof-stage time; < 1 is faster. */
  ratio: number
  /** candidate / baseline peak memory; < 1 is leaner. */
  memoryRatio: number
  baselineS: number
  candidateS: number
  baselinePeakGiB: number | null
  candidatePeakGiB: number | null
}

/** A job-type slice of the basket: "basket" (all families, equally weighted) or a family id. */
export type BucketId = FamilyId

/** Weighted geometric-mean time and memory ratios for one bucket (candidate ÷ baseline). */
export interface Ratios {
  rTime: number
  rMemory: number
}

export interface Candidate {
  prNumber: number
  title: string
  reviewState: ResearchReview["reviewState"]
  decision: string
  samplesPerArm: number
  author: { login: string; avatarUrl: string } | null
  url: string | null
  updatedAt: string | null
  /** Reviewed head commit. */
  headSha: string
  /**
   * When this version of the candidate existed: the reviewed head commit's date, else the
   * PR's creation time. Null when neither is known (the chart then falls back to PR order).
   */
  measuredAt: string | null
  timeSource: "commit" | "pr" | null
  /** Ratios per bucket; null when that bucket's cases weren't all measured. Read via `ratiosFor`. */
  buckets: Readonly<Partial<Record<BucketId, Ratios | null>>>
  /** Inverse family-weighted geometric mean over the full basket; null if incomplete. */
  basketSpeedup: number | null
  cases: CandidateCase[]
  /** Measured cases / cases in the basket. */
  coverage: { measured: number; total: number }
}

/** One bucket's ratios, or null when its cases weren't all measured (or it doesn't exist). */
export const ratiosFor = (candidate: Candidate, bucket: BucketId): Ratios | null =>
  candidate.buckets[bucket] ?? null

/**
 * Paired proof-stage times for one research row, or null when either arm lacks a proof-only
 * interval. Whole-command time is never used: the epoch scores proof execution only.
 */
const proofTimes = (row: ResearchCase) =>
  row.baselineProofS === null || row.candidateProofS === null
    ? null
    : { baseline: row.baselineProofS, candidate: row.candidateProofS }

const geomean = (values: readonly number[]) =>
  Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)

export function buildCandidates(
  challenge: Challenge,
  reviews: readonly ResearchReview[],
  measurements: readonly ResearchCase[],
  pulls: readonly ResearchItem[] | null,
  commitDates: ReadonlyMap<string, string> = new Map(),
): Candidate[] {
  return reviews
    .toSorted((a, b) => a.prNumber - b.prNumber)
    .map((review) => {
      const rows = measurements.filter(
        (row) => row.prNumber === review.prNumber && row.headSha === review.headSha,
      )
      const cases = challenge.cases.flatMap((testCase) => {
        const row = rows.find((item) => item.caseId === testCase.id)
        const times = row === undefined ? null : proofTimes(row)
        return row && times
          ? [
              {
                caseId: testCase.id,
                title: testCase.title,
                family: testCase.family,
                ratio: times.candidate / times.baseline,
                // Unrecorded memory reads as unchanged; memory is never scored.
                memoryRatio:
                  row.candidatePeakGiBRounded === null || row.baselinePeakGiBRounded === null
                    ? 1
                    : row.candidatePeakGiBRounded / row.baselinePeakGiBRounded,
                baselineS: times.baseline,
                candidateS: times.candidate,
                baselinePeakGiB: row.baselinePeakGiBRounded,
                candidatePeakGiB: row.candidatePeakGiBRounded,
              },
            ]
          : []
      })
      const familyRatios = (family: FamilyId): Ratios | null => {
        const expected = challenge.cases.filter((testCase) => testCase.family === family)
        const found = cases.filter((item) => item.family === family)
        return expected.length > 0 && found.length === expected.length
          ? {
              rTime: geomean(found.map((item) => item.ratio)),
              rMemory: geomean(found.map((item) => item.memoryRatio)),
            }
          : null
      }
      const families = challenge.families.map((family) => family.id)
      const perFamily = new Map(families.map((family) => [family, familyRatios(family)]))
      const complete = [...perFamily.values()].filter((value): value is Ratios => value !== null)
      // Each family carries equal log-weight in the basket, as in the judge's scorer.
      const basket: Ratios | null =
        complete.length === families.length
          ? {
              rTime: geomean(complete.map((value) => value.rTime)),
              rMemory: geomean(complete.map((value) => value.rMemory)),
            }
          : null
      const pull = pulls?.find((item) => item.number === review.prNumber)
      return {
        prNumber: review.prNumber,
        title: pull?.title ?? review.title,
        reviewState: review.reviewState,
        decision: review.decision,
        samplesPerArm: review.publicSamplesPerArm,
        author: pull?.author ?? null,
        url: pull?.url ?? null,
        updatedAt: pull?.updatedAt ?? null,
        headSha: review.headSha,
        ...(() => {
          const commit = commitDates.get(review.headSha)
          if (commit !== undefined) return { measuredAt: commit, timeSource: "commit" as const }
          const opened = pull?.createdAt
          return opened === undefined
            ? { measuredAt: null, timeSource: null }
            : { measuredAt: opened, timeSource: "pr" as const }
        })(),
        buckets: { basket, ...Object.fromEntries(perFamily) },
        basketSpeedup: basket === null ? null : 1 / basket.rTime,
        cases,
        coverage: { measured: cases.length, total: challenge.cases.length },
      }
    })
}

/** The judge's track formulas, applied to one bucket's ratios. Higher is better. */
export function trackScore(ratios: Ratios, track: TrackId): number {
  switch (track) {
    case "latency":
      return 1 / ratios.rTime
    case "memory":
      return 1 / ratios.rMemory
    case "balanced":
      return 1 / Math.sqrt(ratios.rTime * ratios.rMemory)
  }
}

export function scoreFor(candidate: Candidate, track: TrackId, bucket: BucketId): number | null {
  const ratios = ratiosFor(candidate, bucket)
  return ratios === null ? null : trackScore(ratios, track)
}

/** True when every candidate has a timestamp, so charts can use a time axis. */
export function allDated(candidates: readonly Candidate[]): boolean {
  return candidates.length > 0 && candidates.every((candidate) => candidate.measuredAt !== null)
}

/** Chronological order when every candidate is dated, otherwise PR order. */
export function chronological(candidates: readonly Candidate[]): Candidate[] {
  return allDated(candidates)
    ? candidates.toSorted((a, b) => {
        const difference = Date.parse(a.measuredAt ?? "") - Date.parse(b.measuredAt ?? "")
        return difference === 0 ? a.prNumber - b.prNumber : difference
      })
    : candidates.toSorted((a, b) => a.prNumber - b.prNumber)
}

/** Best score so far, in the given order: the "standing best" line on the chart. */
export function runningBest(
  candidates: readonly Candidate[],
  track: TrackId,
  bucket: BucketId,
): number[] {
  let best = 1
  return candidates.map((candidate) => {
    const value = scoreFor(candidate, track, bucket)
    if (value !== null && value > best) best = value
    return best
  })
}

/** Candidates no other candidate (or the baseline) beats on both time and memory. */
export function paretoIds(candidates: readonly Candidate[], bucket: BucketId): Set<number> {
  const points = candidates.flatMap((candidate) => {
    const ratios = ratiosFor(candidate, bucket)
    return ratios === null ? [] : [{ id: candidate.prNumber, ...ratios }]
  })
  const all = [...points, { id: 0, rTime: 1, rMemory: 1 }]
  return new Set(
    points
      .filter(
        (point) =>
          !all.some(
            (other) =>
              other.id !== point.id &&
              other.rTime <= point.rTime &&
              other.rMemory <= point.rMemory &&
              (other.rTime < point.rTime || other.rMemory < point.rMemory),
          ),
      )
      .map((point) => point.id),
  )
}

export const REVIEW_STATE_LABEL: Record<Candidate["reviewState"], string> = {
  promoted_direct: "Promoted (direct)",
  ready_to_judge: "Ready to judge",
  research_only: "Research only",
  changes_requested: "Changes requested",
}

export interface CandidateHighlight {
  candidate: Candidate
  pieCount: number
  pieReductionMin: number
  pieReductionMax: number
  /** basketSpeedup − 1, e.g. 0.12 for 12% higher inverse latency. */
  fullBasketGain: number
}

/**
 * The newest directly promoted candidate with a complete basket in which every Cairo case
 * improved. Shared by both routes so their headline figures always agree.
 */
export function candidateHighlight(
  candidates: readonly Candidate[],
  family: FamilyId,
): CandidateHighlight | null {
  const candidate = candidates
    .filter((item) => item.reviewState === "promoted_direct" && item.basketSpeedup !== null)
    .toSorted((a, b) => b.prNumber - a.prNumber)[0]
  if (candidate?.basketSpeedup == null) return null
  const reductions = candidate.cases
    .filter((item) => item.family === family)
    .map((item) => 1 - item.ratio)
  if (reductions.length === 0 || reductions.some((value) => value <= 0)) return null
  return {
    candidate,
    pieCount: reductions.length,
    pieReductionMin: Math.min(...reductions),
    pieReductionMax: Math.max(...reductions),
    fullBasketGain: candidate.basketSpeedup - 1,
  }
}

export interface HistoryMilestone {
  label: string
  order: number
  /** Baseline ÷ milestone proof time over the Cairo cases; < 1 means slower than baseline. */
  speedup: number
  low: number | null
  high: number | null
}

/**
 * Modeled pre-baseline milestones from the proof-progress table, expressed as Cairo-proof
 * speedup against the same pinned baseline the candidates are measured against.
 */
export function historyMilestones(
  rows: readonly {
    kind: string
    milestone: string
    order: number
    proofS: number
    lowS: number | null
    highS: number | null
  }[],
): HistoryMilestone[] {
  const baselineRows = rows.filter((row) => row.kind === "challenge_baseline")
  if (baselineRows.length === 0) return []
  const baseline = geomean(baselineRows.map((row) => row.proofS))
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    if (row.kind !== "historical_model") continue
    const key = `${String(row.order)}:${row.milestone}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()]
    .map((group) => {
      const first = group[0]
      const lows = group.flatMap((row) => (row.lowS === null ? [] : [row.lowS]))
      const highs = group.flatMap((row) => (row.highS === null ? [] : [row.highS]))
      return {
        label: first?.milestone ?? "",
        order: first?.order ?? 0,
        speedup: baseline / geomean(group.map((row) => row.proofS)),
        // A slower bound in seconds is a lower speedup, so the ends swap.
        low: highs.length === group.length ? baseline / geomean(highs) : null,
        high: lows.length === group.length ? baseline / geomean(lows) : null,
      }
    })
    .toSorted((a, b) => a.order - b.order)
}

/** The earliest recorded proof of each Cairo job: the first milestone, per case. */
export interface FirstProof {
  milestone: string
  seconds: ReadonlyMap<string, number>
}

export function firstProofTimes(
  rows: readonly {
    kind: string
    milestone: string
    order: number
    caseId: string
    proofS: number
  }[],
): FirstProof | null {
  const earliest = rows
    .filter((row) => row.kind === "historical_model")
    .toSorted((a, b) => a.order - b.order)[0]
  if (earliest === undefined) return null
  const group = rows.filter(
    (row) =>
      row.kind === "historical_model" &&
      row.order === earliest.order &&
      row.milestone === earliest.milestone,
  )
  return {
    milestone: earliest.milestone,
    seconds: new Map(group.map((row) => [row.caseId, row.proofS])),
  }
}

/** Cairo proof speedup from the first recorded milestone to the best reviewed candidate. */
export interface CairoProgress {
  since: string
  speedup: number
  /** Share of Cairo proof time removed since the first milestone, 0–1. */
  reduction: number
}

export function cairoProgress(
  candidates: readonly Candidate[],
  history: readonly HistoryMilestone[],
  family: FamilyId,
): CairoProgress | null {
  const first = history[0]
  if (first === undefined) return null
  const best = Math.max(
    1,
    ...candidates.flatMap((candidate) => {
      const value = scoreFor(candidate, "latency", family)
      return value === null ? [] : [value]
    }),
  )
  const speedup = best / first.speedup
  return { since: first.label, speedup, reduction: 1 - 1 / speedup }
}
