"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import type { Circuit, CircuitTarget } from "@/data/circuit/schema"
import { circuitDate, circuitLabel, formatProduct, formatToffoli } from "@/lib/circuit"
import { formatDate } from "@/lib/dates"

import { createScale } from "../chart/scales"

export type CircuitChartMode = "frontier" | "history"

const HEIGHT = 440
const MARGIN = { top: 28, right: 28, bottom: 64, left: 76 }

const MODES: { value: CircuitChartMode; label: string }[] = [
  { value: "history", label: "Over time" },
  { value: "frontier", label: "Frontier" },
]

const DESCRIPTIONS: Record<CircuitChartMode, string> = {
  frontier:
    "Each dot is a validated circuit. Circuits on the line cannot be beaten on Toffolis and qubits at once. The orange point is the baseline. Lower left is better.",
  history:
    "Each dot is a validated circuit, by the date it was first measured. The green line is the track's best score so far, the orange line the baseline. Lower is better.",
}

interface Point {
  circuit: Circuit
  x: number
  y: number
  onLine: boolean
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(960)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [ref, width]
}

/** Round ticks on a log axis: 1, 2, 5 per decade, thinned or densified to fit the domain. */
function logTicks([low, high]: [number, number]): number[] {
  const pick = (mantissas: readonly number[]) => {
    const ticks: number[] = []
    for (let power = Math.floor(Math.log10(low)); power <= Math.ceil(Math.log10(high)); power += 1)
      for (const mantissa of mantissas) {
        const value = mantissa * 10 ** power
        if (value >= low && value <= high) ticks.push(value)
      }
    return ticks
  }
  const coarse = pick([1, 2, 5])
  return coarse.length >= 3 ? coarse : pick([1, 1.5, 2, 3, 4, 5, 6, 8])
}

const padLog = (values: readonly number[]): [number, number] => {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = (high / low) ** 0.06
  return [low / pad, high * pad]
}

/**
 * Plotted coordinates are rounded to hundredths of a pixel: `Math.log10` differs in its last
 * bits between the server's runtime and the browser, and unrounded values break hydration.
 */
function roundedScale(...args: Parameters<typeof createScale>) {
  const scale = createScale(...args)
  return (value: number): number => Math.round(scale(value) * 100) / 100
}

const compact = (value: number): string =>
  value >= 1e9
    ? `${formatNumber(value / 1e9, 1)}B`
    : value >= 1e6
      ? `${formatNumber(value / 1e6, value >= 1e7 ? 0 : 1)}M`
      : value >= 1e4
        ? `${formatNumber(value / 1e3, 0)}k`
        : formatNumber(value)

/**
 * The track's circuits on one plane. "Frontier" plots Toffolis against qubits with the Pareto
 * line and the published point; "Over time" plots the score by date with the running best.
 * Selecting an architecture in the table brings its circuits forward.
 */
export function CircuitChart({
  circuits,
  front,
  history,
  targets,
  baseline,
  architectureNames,
  selected,
  mode,
  onModeChange,
}: {
  circuits: readonly Circuit[]
  front: readonly Circuit[]
  history: readonly Circuit[]
  targets: readonly CircuitTarget[]
  /** The track's baseline circuit, marked on both views. */
  baseline: Circuit | null
  architectureNames: Readonly<Record<string, string>>
  /** Architecture id brought forward, or null for all. */
  selected: string | null
  mode: CircuitChartMode
  onModeChange: (mode: CircuitChartMode) => void
}) {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<Point | null>(null)
  const innerWidth = Math.max(120, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const model = useMemo(() => {
    if (circuits.length === 0) return null
    if (mode === "frontier") {
      const onLine = new Set(front.map((circuit) => circuit.opsSha256))
      const xDomain = padLog([
        ...circuits.map((circuit) => circuit.qubits),
        ...targets.map((target) => target.qubitsPublished),
      ])
      const yDomain = padLog([
        ...circuits.map((circuit) => circuit.toffoli),
        ...targets.map((target) => target.toffoliHarnessEquivalent),
      ])
      const x = roundedScale("log", xDomain, [0, innerWidth])
      const y = roundedScale("log", yDomain, [innerHeight, 0])
      const points = circuits.map((circuit) => ({
        circuit,
        x: x(circuit.qubits),
        y: y(circuit.toffoli),
        onLine: onLine.has(circuit.opsSha256),
      }))
      // A minimisation staircase: hold the Toffoli count until the next front circuit's qubits.
      const steps = front.toSorted((a, b) => a.qubits - b.qubits)
      const path = steps
        .map((circuit, index) => {
          const px = x(circuit.qubits)
          const py = y(circuit.toffoli)
          return index === 0 ? `M${String(px)},0V${String(py)}` : `H${String(px)}V${String(py)}`
        })
        .join("")
      return {
        points,
        path: steps.length === 0 ? "" : `${path}H${String(innerWidth)}`,
        xTicks: logTicks(xDomain).map((tick) => ({ at: x(tick), label: compact(tick) })),
        yTicks: logTicks(yDomain).map((tick) => ({ at: y(tick), label: compact(tick) })),
        targets: targets.map((target) => ({
          target,
          x: x(target.qubitsPublished),
          y: y(target.toffoliHarnessEquivalent),
        })),
        baselinePoint: baseline === null ? null : { x: x(baseline.qubits), y: y(baseline.toffoli) },
        baselineLine: null,
        xTitle: "Peak logical qubits (lower is better)",
        yTitle: "Toffolis per walk step (lower is better)",
      }
    }
    const onLine = new Set(history.map((circuit) => circuit.opsSha256))
    const times = circuits.map((circuit) => circuit.unixTime)
    const start = Math.min(...times)
    const end = Math.max(...times)
    const span = Math.max(end - start, 86_400)
    const xDomain: [number, number] = [start - span * 0.04, end + span * 0.08]
    const yDomain = padLog(circuits.map((circuit) => circuit.score))
    const x = roundedScale("lin", xDomain, [0, innerWidth])
    const y = roundedScale("log", yDomain, [innerHeight, 0])
    const points = circuits.map((circuit) => ({
      circuit,
      x: x(circuit.unixTime),
      y: y(circuit.score),
      onLine: onLine.has(circuit.opsSha256),
    }))
    const path = history
      .map((circuit, index) => {
        const px = x(circuit.unixTime)
        const py = y(circuit.score)
        return index === 0 ? `M${String(px)},${String(py)}` : `H${String(px)}V${String(py)}`
      })
      .join("")
    const days = Array.from({ length: 5 }, (_, index) => start + (span * index) / 4)
    return {
      points,
      path: history.length === 0 ? "" : `${path}H${String(innerWidth)}`,
      xTicks: days.map((tick) => ({
        at: x(tick),
        label: formatDate(new Date(tick * 1000).toISOString()),
      })),
      yTicks: logTicks(yDomain).map((tick) => ({ at: y(tick), label: compact(tick) })),
      targets: [],
      baselinePoint: null,
      baselineLine: baseline === null ? null : y(baseline.score),
      xTitle: "Date first measured",
      yTitle: "Score: Toffolis × qubits (lower is better)",
    }
  }, [circuits, front, history, targets, baseline, mode, innerWidth, innerHeight])

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    if (!model) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - bounds.left
    const py = event.clientY - bounds.top
    let nearest: Point | null = null
    let nearestDistance = Infinity
    for (const point of model.points) {
      // Prefer the selected architecture's circuits when several dots overlap.
      const bias = selected !== null && point.circuit.architecture !== selected ? 6 : 0
      const distance = Math.hypot(point.x - px, point.y - py) + bias
      if (distance < nearestDistance) {
        nearest = point
        nearestDistance = distance
      }
    }
    setHover(nearestDistance < 40 ? nearest : null)
  }

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-fg-muted">{DESCRIPTIONS[mode]}</p>
        <SegmentedControl
          aria-label="Chart"
          size="sm"
          value={mode}
          onValueChange={(next) => {
            setHover(null)
            onModeChange(next)
          }}
          options={MODES}
        />
      </div>

      <div ref={containerRef} className="relative mt-4">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            mode === "frontier"
              ? "Validated circuits by peak qubits and Toffolis per step, with the Pareto front"
              : "Validated circuits by date and score, with the running best"
          }
          className="overflow-visible"
        >
          {model === null ? null : (
            <g transform={`translate(${String(MARGIN.left)},${String(MARGIN.top)})`}>
              {model.yTicks.map((tick) => (
                <g key={`y-${tick.label}`} transform={`translate(0,${String(tick.at)})`}>
                  <line x2={innerWidth} stroke="var(--ar-line)" />
                  <text
                    x={-12}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-fg-faint font-mono text-[10px]"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
              {model.xTicks.map((tick) => (
                <text
                  key={`x-${tick.label}`}
                  x={tick.at}
                  y={innerHeight + 26}
                  textAnchor="middle"
                  className="fill-fg-faint font-mono text-[10px]"
                >
                  {tick.label}
                </text>
              ))}
              <text
                transform={`translate(${String(-MARGIN.left + 14)},${String(innerHeight / 2)}) rotate(-90)`}
                textAnchor="middle"
                className="fill-fg-muted text-[11px]"
              >
                {model.yTitle}
              </text>
              <text
                x={innerWidth / 2}
                y={innerHeight + 52}
                textAnchor="middle"
                className="fill-fg-muted text-[11px]"
              >
                {model.xTitle}
              </text>
              {mode === "frontier" ? (
                <text x={8} y={innerHeight - 10} className="fill-fg-faint font-mono text-[10px]">
                  ↙ better on both
                </text>
              ) : null}

              {model.baselineLine === null ? null : (
                <g>
                  <line
                    x2={innerWidth}
                    y1={model.baselineLine}
                    y2={model.baselineLine}
                    stroke="var(--ar-heat)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={innerWidth}
                    y={model.baselineLine - 8}
                    textAnchor="end"
                    fill="var(--ar-heat)"
                    className="font-mono text-[10px]"
                  >
                    baseline · Low et al. 2025 · {compact(baseline?.score ?? 0)}
                  </text>
                </g>
              )}
              {model.targets.map(({ target, x, y }) => (
                <g key={target.id} transform={`translate(${String(x)},${String(y)})`}>
                  <circle r={4} fill="none" stroke="var(--ar-fg-muted)" strokeWidth={1.5} />
                  <text
                    x={8}
                    dy="1.9em"
                    textAnchor="end"
                    className="fill-fg-muted font-mono text-[10px]"
                  >
                    {target.label.split(",")[0]} · published
                  </text>
                </g>
              ))}

              <motion.path
                key={`line-${mode}`}
                d={model.path}
                fill="none"
                stroke="var(--ar-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}
              />

              {model.points.map((point) => {
                const forward = selected === null || point.circuit.architecture === selected
                return (
                  <circle
                    key={point.circuit.opsSha256}
                    cx={point.x}
                    cy={point.y}
                    r={point.onLine ? 3 : 2}
                    fill={point.onLine ? "var(--ar-bg)" : "var(--ar-fg-muted)"}
                    fillOpacity={point.onLine ? 1 : forward ? 0.6 : 0.12}
                    stroke={point.onLine ? "var(--ar-accent)" : "none"}
                    strokeOpacity={forward ? 1 : 0.25}
                    strokeWidth={1.5}
                  />
                )
              })}

              {model.baselinePoint === null ? null : (
                <g
                  transform={`translate(${String(model.baselinePoint.x)},${String(model.baselinePoint.y)})`}
                >
                  <circle r={9} fill="var(--ar-heat-soft)" />
                  <circle r={4.5} fill="var(--ar-heat)" stroke="var(--ar-bg)" strokeWidth={1.5} />
                  <text
                    y={-14}
                    textAnchor="middle"
                    fill="var(--ar-heat)"
                    className="font-mono text-[10px]"
                  >
                    baseline · Low et al. 2025
                  </text>
                </g>
              )}

              <AnimatePresence>
                {hover ? (
                  <motion.g
                    key="crosshair"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    pointerEvents="none"
                  >
                    <circle cx={hover.x} cy={hover.y} r={7} fill="none" stroke="var(--ar-accent)" />
                  </motion.g>
                ) : null}
              </AnimatePresence>

              <rect
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => {
                  setHover(null)
                }}
              />
            </g>
          )}
        </svg>

        {circuits.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-6">
            <p className="max-w-md rounded-xl border border-line bg-bg/80 px-4 py-3 text-center text-sm text-fg-muted backdrop-blur">
              No validated circuits on this track yet.
            </p>
          </div>
        ) : null}

        <AnimatePresence>
          {hover ? (
            <motion.div
              key="tip"
              className="pointer-events-none absolute z-10 w-64 rounded-xl border border-line-strong bg-surface-strong/95 p-3 text-xs shadow-2xl backdrop-blur"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: Math.min(width - 264, Math.max(0, hover.x + MARGIN.left + 16)),
                top: Math.max(0, hover.y + MARGIN.top - 110),
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {architectureNames[hover.circuit.architecture] ?? hover.circuit.architecture}
                </span>
                {hover.onLine ? (
                  <span className="text-fg-faint">
                    {mode === "frontier" ? "on the front" : "best so far"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate font-mono text-fg-muted">{circuitLabel(hover.circuit)}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 font-mono tabular">
                <div>
                  <dt className="text-fg-faint">Toffolis</dt>
                  <dd>{formatToffoli(hover.circuit.toffoli)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">Qubits</dt>
                  <dd>{formatNumber(hover.circuit.qubits)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">Score</dt>
                  <dd>{formatProduct(hover.circuit.score)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-fg-faint">
                {hover.circuit.opsSha256 === baseline?.opsSha256 ? "Track baseline · " : ""}
                {formatDate(circuitDate(hover.circuit))}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
