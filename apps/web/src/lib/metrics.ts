import type { TrackId } from "@/data/schema"

/**
 * One source of truth for what the scoring symbols mean, so every chart axis, table header
 * and tooltip explains R_T and R_M the same way.
 */
export const METRICS = {
  rTime: {
    symbol: "R_T",
    name: "Command time",
    axis: "R_T · command time vs baseline",
    direction: "lower is faster",
    hint: "1.00 = baseline · 0.80 = 20% less command time",
    definition:
      "Weighted geometric mean of each case's adapted-input-to-publication time divided by the baseline's.",
  },
  rMemory: {
    symbol: "R_M",
    name: "Device peak",
    axis: "R_M · device peak memory vs baseline",
    direction: "lower is leaner",
    hint: "1.00 = baseline · 0.80 = 20% less device peak memory",
    definition:
      "Weighted geometric mean of each case's whole-device peak memory divided by the baseline's.",
  },
} as const

export const TRACK_AXIS: Record<TrackId, string> = {
  latency: "Latency score · 1 / R_T",
  memory: "Memory score · 1 / R_M",
  balanced: "Balanced score · 1 / √(R_T · R_M)",
}
