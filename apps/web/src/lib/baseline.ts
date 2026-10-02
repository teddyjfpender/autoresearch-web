import { formatNumber } from "@autoresearch/ui/lib/format"

import type { Challenge } from "@/data/schema"
import { formatDate } from "@/lib/dates"
import { formatGB, formatSeconds } from "@/lib/format"

/** Human-readable direct H200 measurements, not ranked score denominators. */
export function summarizeBaseline(challenge: Challenge) {
  const cairo = challenge.cases.flatMap((testCase) =>
    testCase.family === "pie" && testCase.baseline.proofTimeS !== null
      ? [testCase.baseline.proofTimeS]
      : [],
  )
  const peaks = challenge.cases.map((testCase) => testCase.baseline.peakBytes)
  return {
    baseline: {
      cairoRange:
        cairo.length === 0
          ? "pending"
          : `${formatNumber(Math.min(...cairo), 2)}–${formatSeconds(Math.max(...cairo))}`,
      peakRange: `${formatGB(Math.min(...peaks), 0).replace(" GB", "")}–${formatGB(Math.max(...peaks), 0)}`,
      measured: formatDate(challenge.contract.baselineMeasuredAt),
      rounds: Math.max(...challenge.cases.map((testCase) => testCase.baseline.rounds)),
    },
  }
}
