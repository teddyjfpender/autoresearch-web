import { formatNumber } from "@autoresearch/ui/lib/format"

/** Track score, e.g. "1.284×". */
export const formatScore = (score: number): string => `${formatNumber(score, 3)}×`

/** Ratio vs baseline, e.g. "0.812". */
export const formatRatio = (ratio: number): string => formatNumber(ratio, 3)

/** Decimal gigabytes, matching how the judge reports NVML whole-device usage. */
export const formatGB = (bytes: number, digits = 1): string =>
  `${formatNumber(bytes / 1e9, digits)} GB`

export const formatSeconds = (seconds: number): string =>
  `${formatNumber(seconds, seconds < 10 ? 2 : 1)} s`

/** Relative change as a signed percentage, from a ratio (0.9 → "−10.0%"). */
export const formatChange = (ratio: number, digits = 1): string => {
  const pct = (ratio - 1) * 100
  if (Math.abs(pct) < 0.05) return "±0%"
  return `${pct < 0 ? "−" : "+"}${formatNumber(Math.abs(pct), digits)}%`
}
