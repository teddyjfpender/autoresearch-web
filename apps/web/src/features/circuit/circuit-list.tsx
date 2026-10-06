import { cn } from "@autoresearch/ui/lib/cn"
import { formatNumber } from "@autoresearch/ui/lib/format"

import type { Circuit } from "@/data/circuit/schema"
import {
  circuitDate,
  circuitLabel,
  formatCircuitScore,
  formatProduct,
  formatToffoli,
} from "@/lib/circuit"
import { formatDate } from "@/lib/dates"

/** The Toffoli-qubit front, fewest qubits first: the secondary, circuit-level view. */
export function CircuitList({
  circuits,
  architectureNames,
  repo,
  best,
}: {
  circuits: readonly Circuit[]
  architectureNames: Readonly<Record<string, string>>
  repo: string
  /** The track's best-score circuit, marked in the list. */
  best: Circuit | null
}) {
  const headers = ["Qubits", "Toffolis", "Product", "Score", "Architecture", "Circuit", "Measured"]
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-fg-muted">
        The Toffoli–qubit front: every circuit here has fewer Toffolis than any recorded circuit
        with as few qubits. Each row is authenticated in the ledger by the SHA-256 of its op stream,
        its lane seed and the evaluator that passed it.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line">
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    "h-10 px-4 text-label font-normal sm:px-6",
                    index < 4 ? "text-right" : "text-left",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {circuits.map((circuit) => {
              const leader = best !== null && circuit.opsSha256 === best.opsSha256
              return (
                <tr key={circuit.opsSha256} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular sm:px-6">
                    {formatNumber(circuit.qubits)}
                  </td>
                  <td className="px-4 text-right font-mono text-xs tabular sm:px-6">
                    {formatToffoli(circuit.toffoli)}
                  </td>
                  <td
                    className={cn(
                      "px-4 text-right font-mono text-xs tabular sm:px-6",
                      leader ? "text-accent" : "text-fg-muted",
                    )}
                  >
                    {formatProduct(circuit.toffoliTimesQubits)}
                  </td>
                  <td className="px-4 text-right font-mono text-xs text-fg-muted tabular sm:px-6">
                    {formatCircuitScore(circuit.score)}
                  </td>
                  <td className="px-4 text-fg-muted sm:px-6">
                    {architectureNames[circuit.architecture] ?? circuit.architecture}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 font-mono text-xs sm:px-6">
                    {circuit.pr === null ? (
                      circuitLabel(circuit)
                    ) : (
                      <a
                        href={`${repo}/pull/${String(circuit.pr)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-line-strong underline-offset-4 hover:text-fg"
                      >
                        {circuitLabel(circuit)} · #{circuit.pr}
                      </a>
                    )}
                  </td>
                  <td className="px-4 font-mono text-xs text-fg-faint sm:px-6">
                    {formatDate(circuitDate(circuit))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
