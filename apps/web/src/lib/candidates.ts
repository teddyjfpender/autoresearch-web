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
  /** candidate / baseline time; < 1 is faster. */
  ratio: number
  /** candidate / baseline peak memory; < 1 is leaner. */
  memoryRatio: number
  baselineS: number
  candidateS: number
  baselinePeakGiB: number
  candidatePeakGiB: number
}

/** A job-type slice of the basket: the whole family-weighted basket, or one family. */
export type BucketId = "basket" | FamilyId

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
  /** Ratios per bucket; null when that bucket's cases weren't all measured. */
  buckets: Record<BucketId, Ratios | null>
  /** Inverse family-weighted geometric mean over the full basket; null if incomplete. */
  basketSpeedup: number | null
  /** Inverse geometric mean over the Cairo (PIE) family only; null if incomplete. */
  cairoSpeedup: number | null
  cases: CandidateCase[]
  /** Measured cases / cases in the basket. */
  coverage: { measured: number; total: number }
}

const FAMILIES: readonly FamilyId[] = ["pie", "recursion", "pipeline"]

const ratioOf = (row: ResearchCase) =>
  row.medianPairedCommandRatio ?? row.candidateCommandS / row.baselineCommandS

const geomean = (values: readonly number[]) =>
  Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)

export function buildCandidates(
  challenge: Challenge,
  reviews: readonly ResearchReview[],
  measurements: readonly ResearchCase[],
  pulls: readonly ResearchItem[] | null,
): Candidate[] {
  return reviews
    .toSorted((a, b) => a.prNumber - b.prNumber)
    .map((review) => {
      const rows = measurements.filter(
        (row) => row.prNumber === review.prNumber && row.headSha === review.headSha,
      )
      const cases = challenge.cases.flatMap((testCase) => {
        const row = rows.find((item) => item.caseId === testCase.id)
        return row
          ? [
              {
                caseId: testCase.id,
                title: testCase.title,
                family: testCase.family,
                ratio: ratioOf(row),
                memoryRatio: row.candidatePeakGiBRounded / row.baselinePeakGiBRounded,
                baselineS: row.baselineCommandS,
                candidateS: row.candidateCommandS,
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
      const perFamily = Object.fromEntries(
        FAMILIES.map((family) => [family, familyRatios(family)]),
      ) as Record<FamilyId, Ratios | null>
      const complete = FAMILIES.map((family) => perFamily[family]).filter(
        (value): value is Ratios => value !== null,
      )
      // Each family carries equal log-weight in the basket, as in the judge's scorer.
      const basket: Ratios | null =
        complete.length === FAMILIES.length
          ? {
              rTime: geomean(complete.map((value) => value.rTime)),
              rMemory: geomean(complete.map((value) => value.rMemory)),
            }
          : null
      const pull = pulls?.find((item) => item.number === review.prNumber)
      return {
        prNumber: review.prNumber,
        title: review.title,
        reviewState: review.reviewState,
        decision: review.decision,
        samplesPerArm: review.publicSamplesPerArm,
        author: pull?.author ?? null,
        url: pull?.url ?? null,
        updatedAt: pull?.updatedAt ?? null,
        buckets: { basket, ...perFamily },
        basketSpeedup: basket === null ? null : 1 / basket.rTime,
        cairoSpeedup: perFamily.pie === null ? null : 1 / perFamily.pie.rTime,
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
  const ratios = candidate.buckets[bucket]
  return ratios === null ? null : trackScore(ratios, track)
}

/** Best score so far, in PR order: the "standing best" line on the chart. */
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
    const ratios = candidate.buckets[bucket]
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
export function candidateHighlight(candidates: readonly Candidate[]): CandidateHighlight | null {
  const candidate = candidates
    .filter((item) => item.reviewState === "promoted_direct" && item.basketSpeedup !== null)
    .toSorted((a, b) => b.prNumber - a.prNumber)[0]
  if (candidate?.basketSpeedup == null) return null
  const reductions = candidate.cases
    .filter((item) => item.family === "pie")
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
