import type { ResearchCase, ResearchReview } from "@/data/schema"

export interface ResearchHighlight {
  review: ResearchReview
  pieCount: number
  pieReductionMin: number
  pieReductionMax: number
  fullBasketGain: number
}

/** Summarize one reviewed direct H200 result without treating it as a ranked score. */
export function researchHighlight(
  reviews: readonly ResearchReview[],
  measurements: readonly ResearchCase[],
): ResearchHighlight | null {
  const review = reviews
    .filter((entry) => entry.reviewState === "promoted_direct")
    .toSorted((a, b) => b.prNumber - a.prNumber)[0]
  if (!review) return null

  const rows = measurements.filter(
    (row) =>
      row.prNumber === review.prNumber &&
      row.headSha === review.headSha &&
      row.patchSha256 === review.patchSha256 &&
      row.medianPairedCommandRatio !== null,
  )
  const pies = rows.filter((row) => row.family === "pie")
  if (pies.length === 0) return null
  const reductions = pies.map((row) => 1 - (row.medianPairedCommandRatio ?? 1))
  if (reductions.some((value) => value <= 0)) return null

  const familyRatios: number[] = []
  for (const family of ["pie", "recursion", "pipeline"] as const) {
    const familyRows = rows.filter((row) => row.family === family)
    if (familyRows.length === 0) return null
    familyRatios.push(
      Math.exp(
        familyRows.reduce((sum, row) => sum + Math.log(row.medianPairedCommandRatio ?? 1), 0) /
          familyRows.length,
      ),
    )
  }
  const fullBasketRatio = Math.exp(
    familyRatios.reduce((sum, value) => sum + Math.log(value), 0) / familyRatios.length,
  )
  return {
    review,
    pieCount: pies.length,
    pieReductionMin: Math.min(...reductions),
    pieReductionMax: Math.max(...reductions),
    fullBasketGain: 1 / fullBasketRatio - 1,
  }
}
