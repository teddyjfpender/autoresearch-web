"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import type { Instance } from "@/data/script/schema"
import { formatDate } from "@/lib/dates"
import { formatScore, formatWork, instanceDate, instanceLabel } from "@/lib/script"

import { createScale } from "../chart/scales"

export type ScriptChartMode = "frontier" | "history"

const HEIGHT = 440
const MARGIN = { top: 28, right: 28, bottom: 64, left: 76 }

const MODES: { value: ScriptChartMode; label: string }[] = [
  { value: "history", label: "Over time" },
  { value: "frontier", label: "Trade-off" },
]

const DESCRIPTIONS: Record<ScriptChartMode, string> = {
  frontier:
    "Each dot is a validated script. Ringed dots cannot be beaten on bytes, opcodes and work at once; the line is the least work at each size. The orange point is the baseline. Lower left is better.",
  history:
    "Each dot is a validated script, by the date it was recorded. The green line is the track's best score so far, the orange line the baseline. Lower is better.",
}

interface Point {
  instance: Instance
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
  const pad = Math.max(high / low, 1.2) ** 0.06
  return [low / pad, high * pad]
}

const padLinear = (values: readonly number[], least: number): [number, number] => {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max(high - low, least) * 0.08
  return [low - pad, high + pad]
}

/**
 * Plotted coordinates are rounded to hundredths of a pixel: `Math.log10` differs in its last
 * bits between the server's runtime and the browser, and unrounded values break hydration.
 */
function roundedScale(...args: Parameters<typeof createScale>) {
  const scale = createScale(...args)
  return Object.assign((value: number): number => Math.round(scale(value) * 100) / 100, {
    ticks: scale.ticks,
  })
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
 * The track's instances on one plane. "Trade-off" plots honest work against script bytes, with
 * the three-way front ringed; "Over time" plots the score by date with the running best.
 * Selecting an architecture in the table brings its instances forward.
 */
export function ScriptChart({
  instances,
  front,
  history,
  baseline,
  floorBits,
  architectureNames,
  selected,
  mode,
  onModeChange,
}: {
  instances: readonly Instance[]
  front: readonly Instance[]
  history: readonly Instance[]
  /** The track's baseline instance, marked on both views. */
  baseline: Instance | null
  /** The security level every instance of the track is at or above. */
  floorBits: number
  architectureNames: Readonly<Record<string, string>>
  /** Architecture id brought forward, or null for all. */
  selected: string | null
  mode: ScriptChartMode
  /** Null when only one view applies and the switch is hidden. */
  onModeChange: ((mode: ScriptChartMode) => void) | null
}) {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<Point | null>(null)
  const innerWidth = Math.max(120, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const model = useMemo(() => {
    if (instances.length === 0) return null
    if (mode === "frontier") {
      const onLine = new Set(front.map((instance) => instance.instanceSha256))
      const xDomain = padLinear(
        instances.map((instance) => instance.bytes),
        500,
      )
      const yDomain = padLinear(
        instances.map((instance) => instance.workBits),
        0.5,
      )
      const x = roundedScale("lin", xDomain, [0, innerWidth])
      const y = roundedScale("lin", yDomain, [innerHeight, 0])
      const points = instances.map((instance) => ({
        instance,
        x: x(instance.bytes),
        y: y(instance.workBits),
        onLine: onLine.has(instance.instanceSha256),
      }))
      // A minimisation staircase over bytes and work: hold the work until a larger script needs less.
      const steps = instances
        .toSorted((a, b) => (a.bytes === b.bytes ? a.workBits - b.workBits : a.bytes - b.bytes))
        .reduce<Instance[]>(
          (kept, instance) =>
            instance.workBits < (kept.at(-1)?.workBits ?? Infinity) ? [...kept, instance] : kept,
          [],
        )
      const path = steps
        .map((instance, index) => {
          const px = x(instance.bytes)
          const py = y(instance.workBits)
          return index === 0 ? `M${String(px)},0V${String(py)}` : `H${String(px)}V${String(py)}`
        })
        .join("")
      return {
        points,
        path: steps.length === 0 ? "" : `${path}H${String(innerWidth)}`,
        xTicks: x.ticks(6).map((tick) => ({ at: x(tick), label: formatNumber(tick) })),
        yTicks: y.ticks(6).map((tick) => ({ at: y(tick), label: `2^${formatNumber(tick, 2)}` })),
        baselinePoint: baseline === null ? null : { x: x(baseline.bytes), y: y(baseline.workBits) },
        baselineLine: null,
        xTitle: "Script bytes, locking plus unlocking (lower is better)",
        yTitle: "Honest work, SHA-256 compressions (lower is better)",
      }
    }
    const onLine = new Set(history.map((instance) => instance.instanceSha256))
    const times = instances.map((instance) => instance.unixTime)
    const start = Math.min(...times)
    const end = Math.max(...times)
    const span = Math.max(end - start, 86_400)
    const xDomain: [number, number] = [start - span * 0.04, end + span * 0.08]
    const yDomain = padLog(instances.map((instance) => instance.score))
    const x = roundedScale("lin", xDomain, [0, innerWidth])
    const y = roundedScale("log", yDomain, [innerHeight, 0])
    const points = instances.map((instance) => ({
      instance,
      x: x(instance.unixTime),
      y: y(instance.score),
      onLine: onLine.has(instance.instanceSha256),
    }))
    const path = history
      .map((instance, index) => {
        const px = x(instance.unixTime)
        const py = y(instance.score)
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
      baselinePoint: null,
      baselineLine: baseline === null ? null : y(baseline.score),
      xTitle: "Date recorded",
      yTitle: "Score: bytes × opcodes × work (lower is better)",
    }
  }, [instances, front, history, baseline, mode, innerWidth, innerHeight])

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    if (!model) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - bounds.left
    const py = event.clientY - bounds.top
    let nearest: Point | null = null
    let nearestDistance = Infinity
    for (const point of model.points) {
      // Prefer the selected architecture's instances when several dots overlap.
      const bias = selected !== null && point.instance.architecture !== selected ? 6 : 0
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
        <p className="max-w-2xl text-sm text-fg-muted">
          {DESCRIPTIONS[mode]} Every script is at or above {formatNumber(floorBits, 1)} bits.
        </p>
        {onModeChange === null ? null : (
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
        )}
      </div>

      <div ref={containerRef} className="relative mt-4">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            mode === "frontier"
              ? "Validated scripts by bytes and honest work, with the trade-off front"
              : "Validated scripts by date and score, with the running best"
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
                    baseline · the paper&apos;s script · {compact(baseline?.score ?? 0)}
                  </text>
                </g>
              )}

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
                const forward = selected === null || point.instance.architecture === selected
                return (
                  <circle
                    key={point.instance.instanceSha256}
                    cx={point.x}
                    cy={point.y}
                    r={point.onLine ? 3.5 : 2.5}
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
                    baseline · the paper&apos;s script
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

        {instances.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-6">
            <p className="max-w-md rounded-xl border border-line bg-bg/80 px-4 py-3 text-center text-sm text-fg-muted backdrop-blur">
              No validated scripts on this track yet.
            </p>
          </div>
        ) : null}

        <AnimatePresence>
          {hover ? (
            <motion.div
              key="tip"
              className="pointer-events-none absolute z-10 w-72 rounded-xl border border-line-strong bg-surface-strong/95 p-3 text-xs shadow-2xl backdrop-blur"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: Math.min(width - 296, Math.max(0, hover.x + MARGIN.left + 16)),
                top: Math.max(0, hover.y + MARGIN.top - 120),
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {architectureNames[hover.instance.architecture] ?? hover.instance.architecture}
                </span>
                {hover.onLine ? (
                  <span className="text-fg-faint">
                    {mode === "frontier" ? "on the front" : "best so far"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate font-mono text-fg-muted">
                {instanceLabel(hover.instance)}
              </p>
              <dl className="mt-2 grid grid-cols-4 gap-2 font-mono tabular">
                <div>
                  <dt className="text-fg-faint">Bytes</dt>
                  <dd>{formatNumber(hover.instance.bytes)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">Opcodes</dt>
                  <dd>{formatNumber(hover.instance.opcodes)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">Work</dt>
                  <dd>{formatWork(hover.instance.workBits)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">Score</dt>
                  <dd>{formatScore(hover.instance.score)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-fg-faint">
                {hover.instance.instanceSha256 === baseline?.instanceSha256
                  ? "Track baseline · "
                  : ""}
                {formatNumber(hover.instance.securityBits, 2)} bits ·{" "}
                {hover.instance.provisional
                  ? "measured, not yet recorded"
                  : formatDate(instanceDate(hover.instance))}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
