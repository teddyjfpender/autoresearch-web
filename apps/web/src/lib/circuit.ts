import { formatNumber } from "@autoresearch/ui/lib/format"

import type { Circuit, CircuitChallenge } from "@/data/circuit/schema"

/** Toffolis per step, e.g. "11,500". */
export const formatToffoli = (value: number): string => formatNumber(Math.round(value))

/** A Toffoli x qubit product, e.g. "3.60M". */
export const formatProduct = (value: number): string =>
  value >= 1e9
    ? `${formatNumber(value / 1e9, 2)}B`
    : value >= 1e6
      ? `${formatNumber(value / 1e6, 2)}M`
      : formatNumber(Math.round(value))

/** The challenge score in engineering notation, e.g. "7.69e7". */
export const formatCircuitScore = (score: number): string => {
  const exponent = Math.floor(Math.log10(score))
  return `${formatNumber(score / 10 ** exponent, 2)}e${String(exponent)}`
}

export const circuitDate = (circuit: Circuit): string =>
  new Date(circuit.unixTime * 1000).toISOString()

/** "pin:kc_r3re_m8" -> "kc_r3re_m8"; "li/low2025-reference" -> "low2025-reference". */
export const circuitLabel = (circuit: Circuit): string =>
  circuit.submission.replace(/^pin:/, "").replace(/^[a-z0-9-]+\//, "")

export interface CircuitSummary {
  best: Circuit | null
  fewestToffoli: Circuit | null
  fewestQubits: Circuit | null
  /** Share of the score removed since the track's first recorded circuit, 0..1. */
  reduction: number | null
  first: Circuit | null
}

const least = (circuits: readonly Circuit[], key: (circuit: Circuit) => number): Circuit | null =>
  circuits.reduce<Circuit | null>(
    (lowest, circuit) => (lowest === null || key(circuit) < key(lowest) ? circuit : lowest),
    null,
  )

export function summarizeCircuits(challenge: CircuitChallenge): CircuitSummary {
  const { board, circuits } = challenge
  const first = board.history[0] ?? null
  const best = board.best
  return {
    best,
    fewestToffoli: least(circuits, (circuit) => circuit.toffoli),
    fewestQubits: least(circuits, (circuit) => circuit.qubits),
    reduction: first === null || best === null ? null : 1 - best.score / first.score,
    first,
  }
}
