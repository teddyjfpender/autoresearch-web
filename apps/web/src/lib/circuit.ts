import { formatNumber } from "@autoresearch/ui/lib/format"

import type { Circuit, CircuitTrack } from "@/data/circuit/schema"

/** Toffolis per step, e.g. "11,500". */
export const formatToffoli = (value: number): string => formatNumber(Math.round(value))

/** A Toffoli x qubit product, e.g. "3.60M". */
export const formatProduct = (value: number): string =>
  value >= 1e9
    ? `${formatNumber(value / 1e9, 2)}B`
    : value >= 1e6
      ? `${formatNumber(value / 1e6, 2)}M`
      : formatNumber(Math.round(value))

export const circuitDate = (circuit: Circuit): string =>
  new Date(circuit.unixTime * 1000).toISOString()

/** "pin:kc_r3re_m8" -> "kc_r3re_m8"; "li/low2025-reference" -> "low2025-reference". */
export const circuitLabel = (circuit: Circuit): string =>
  circuit.submission.replace(/^pin:/, "").replace(/^[a-z0-9-]+\//, "")

export interface CircuitSummary {
  best: Circuit | null
  fewestToffoli: Circuit | null
  fewestQubits: Circuit | null
  /** The reference the reduction is measured from: the track's baseline, else its first circuit. */
  reference: { circuit: Circuit; kind: "baseline" | "first" } | null
  /** Share of the reference score removed by the best circuit, 0..1. */
  reduction: number | null
}

const least = (circuits: readonly Circuit[], key: (circuit: Circuit) => number): Circuit | null =>
  circuits.reduce<Circuit | null>(
    (lowest, circuit) => (lowest === null || key(circuit) < key(lowest) ? circuit : lowest),
    null,
  )

export function summarizeCircuits(track: CircuitTrack): CircuitSummary {
  const { board, circuits } = track
  const best = board.best
  const first = board.history[0]
  const reference: CircuitSummary["reference"] =
    board.baseline != null
      ? { circuit: board.baseline, kind: "baseline" }
      : first === undefined
        ? null
        : { circuit: first, kind: "first" }
  return {
    best,
    fewestToffoli: least(circuits, (circuit) => circuit.toffoli),
    fewestQubits: least(circuits, (circuit) => circuit.qubits),
    reference,
    reduction:
      reference === null || best === null ? null : 1 - best.score / reference.circuit.score,
  }
}
