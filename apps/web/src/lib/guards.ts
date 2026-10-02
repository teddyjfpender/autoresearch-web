import type { Guard } from "@/data/schema"

/** "Every case M / M₀ ≤ 1.10" or "R_T ≤ 1.25", generated from the structured guard. */
export function guardLabel(guard: Guard): string {
  const limit = guard.max.toFixed(2)
  if (guard.scope === "aggregate") return `${guard.metric === "time" ? "R_T" : "R_M"} ≤ ${limit}`
  return `Every case ${guard.metric === "time" ? "T / T₀" : "M / M₀"} ≤ ${limit}`
}
