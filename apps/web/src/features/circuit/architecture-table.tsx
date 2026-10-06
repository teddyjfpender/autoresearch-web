"use client"

import { Badge } from "@autoresearch/ui/components/badge"
import { cn } from "@autoresearch/ui/lib/cn"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import type { CircuitArchitecture, CircuitTrackBoard } from "@/data/circuit/schema"
import { circuitDate, circuitLabel, formatProduct, formatToffoli } from "@/lib/circuit"
import { formatDate } from "@/lib/dates"

type Row = CircuitTrackBoard["architectures"][number]

function Breakout({ row, registry }: { row: Row; registry: CircuitArchitecture | undefined }) {
  const facts = [
    { label: "Best score", circuit: row.elite },
    { label: "Fewest Toffolis", circuit: row.fewestToffoli },
    { label: "Fewest qubits", circuit: row.fewestQubits },
  ]
  return (
    <div className="space-y-6 px-4 pt-2 pb-6 sm:px-6">
      {registry === undefined ? null : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-label">Mechanism</p>
            <p className="mt-2 text-sm text-fg-muted">{registry.mechanism}</p>
          </div>
          <div>
            <p className="text-label">What sets it apart</p>
            <p className="mt-2 text-sm text-fg-muted">{registry.distinguishing}</p>
            {registry.references.length === 0 ? null : (
              <p className="mt-3 text-xs text-fg-faint">{registry.references.join(" · ")}</p>
            )}
          </div>
        </div>
      )}
      <dl className="grid gap-4 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="border-l border-line pl-4">
            <dt className="text-label">{fact.label}</dt>
            <dd className="mt-1 font-mono text-sm tabular">
              {formatToffoli(fact.circuit.toffoli)} × {formatNumber(fact.circuit.qubits)}
            </dd>
            <dd className="mt-0.5 truncate font-mono text-xs text-fg-faint">
              {circuitLabel(fact.circuit)}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-label">Best score over time</p>
        <ul className="mt-2 divide-y divide-line">
          {row.history.toReversed().map((circuit) => (
            <li
              key={circuit.opsSha256}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-4 py-2 text-sm"
            >
              <span className="font-mono text-xs text-fg-faint">
                {formatDate(circuitDate(circuit))}
              </span>
              <span className="truncate font-mono text-xs text-fg-muted">
                {circuitLabel(circuit)}
              </span>
              <span className="font-mono text-xs tabular">
                {formatToffoli(circuit.toffoli)} × {formatNumber(circuit.qubits)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * The primary leaderboard: one row per architecture, best score first, each with its elite
 * circuit. A row opens the architecture's mechanism and history, and brings its circuits
 * forward on the chart.
 */
export function ArchitectureTable({
  rows,
  registry,
  selected,
  onSelect,
}: {
  rows: readonly Row[]
  registry: readonly CircuitArchitecture[]
  selected: string | null
  onSelect: (architecture: string | null) => void
}) {
  const best = rows[0]?.elite.score ?? 1
  const columns =
    "grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_1.5rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_5rem_10rem_7rem_1.5rem]"

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div
        className={cn("hidden gap-4 border-b border-line px-4 py-3 sm:grid sm:px-6", columns)}
        aria-hidden
      >
        <span className="text-label">#</span>
        <span className="text-label">Architecture</span>
        <span className="text-right text-label">Circuits</span>
        <span className="text-right text-label">Toffolis × qubits</span>
        <span className="text-right text-label">Score</span>
        <span />
      </div>
      <ul>
        {rows.map((row, index) => {
          const open = selected === row.id
          const panelId = `architecture-${row.id}`
          return (
            <li key={row.id} className="border-b border-line last:border-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                  onSelect(open ? null : row.id)
                }}
                className={cn(
                  "grid w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors duration-200 hover:bg-surface/60 sm:px-6",
                  columns,
                  open && "bg-surface/40",
                )}
              >
                <span className="font-mono text-xs text-fg-faint tabular">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{row.name}</span>
                    {index === 0 ? (
                      <Badge size="sm" tone="accent">
                        Track leader
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block truncate font-mono text-xs text-fg-faint">
                    {row.id}
                    {row.parent === null || row.parent === undefined ? "" : ` · from ${row.parent}`}
                  </span>
                  <span aria-hidden className="mt-2 block h-1 rounded-full bg-surface">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        index === 0 ? "bg-accent" : "bg-fg-faint",
                      )}
                      style={{ width: `${((best / row.elite.score) * 100).toFixed(2)}%` }}
                    />
                  </span>
                </span>
                <span className="hidden text-right font-mono text-xs text-fg-muted tabular sm:block">
                  {formatNumber(row.circuits)}
                </span>
                <span className="hidden text-right font-mono text-xs text-fg-muted tabular sm:block">
                  {formatToffoli(row.elite.toffoli)} × {formatNumber(row.elite.qubits)}
                </span>
                <span className="text-right font-mono text-sm text-fg tabular">
                  {formatProduct(row.elite.score)}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 justify-self-end text-fg-faint transition-transform duration-500 ease-out-expo",
                    open && "rotate-180 text-fg",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={panelId}
                    key="breakout"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <Breakout row={row} registry={registry.find((item) => item.id === row.id)} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
