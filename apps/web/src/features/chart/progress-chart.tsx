"use client"

import { Avatar } from "@autoresearch/ui/components/avatar"
import { Formula, SvgFormula } from "@autoresearch/ui/components/formula"
import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import type { TrackId } from "@/data/schema"
import { submitterOf } from "@/lib/authors"
import { formatDate, formatDateTime } from "@/lib/dates"
import { formatRatio, formatScore } from "@/lib/format"
import { METRICS, TRACK_AXIS } from "@/lib/metrics"
import { paretoFrontier, promotions, type Scored } from "@/lib/scoring"

import { createScale, extent, type ScaleKind } from "./scales"

type Mode = TrackId | "pareto"

const HEIGHT = 420
const MARGIN = { top: 28, right: 24, bottom: 64, left: 76 }

const MODES: { value: Mode; label: string }[] = [
  { value: "latency", label: "Latency" },
  { value: "memory", label: "Memory" },
  { value: "balanced", label: "Balanced" },
  { value: "pareto", label: "Pareto" },
]

const DESCRIPTIONS: Record<Mode, string> = {
  latency:
    "Each dot is an eligible scorecard; the line is the promoted leader. Higher is faster proving.",
  memory:
    "Each dot is an eligible scorecard; the line is the promoted leader. Higher is leaner proving.",
  balanced:
    "Each dot is an eligible scorecard; the line is the promoted leader. Higher is a better time × memory trade-off.",
  pareto:
    "Each dot is a scorecard. Points on the line can't be beaten on both command time and device peak memory at once.",
}

interface Point {
  scored: Scored
  x: number
  y: number
  highlight: boolean
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

/** Track leader progression over time, or the command time / device peak Pareto frontier. */
export function ProgressChart({
  scored,
  minImprovement,
  baselineDate,
}: {
  scored: readonly Scored[]
  minImprovement: number
  /** When the pinned baseline was measured: the chart's origin, ISO date. */
  baselineDate: string
}) {
  const [mode, setMode] = useState<Mode>("balanced")
  const [scaleKind, setScaleKind] = useState<ScaleKind>("lin")
  const [hover, setHover] = useState<Point | null>(null)
  const [containerRef, width] = useWidth<HTMLDivElement>()

  const innerWidth = Math.max(200, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const model = useMemo(() => {
    if (mode === "pareto") {
      const frontierIds = new Set(paretoFrontier(scored).map((entry) => entry.card.id))
      const xs = [1, ...scored.map((entry) => entry.rMemory)]
      const ys = [1, ...scored.map((entry) => entry.rTime)]
      const x = createScale(scaleKind, extent(xs), [0, innerWidth])
      const y = createScale(scaleKind, extent(ys), [innerHeight, 0])
      const points: Point[] = scored.map((entry) => ({
        scored: entry,
        x: x(entry.rMemory),
        y: y(entry.rTime),
        highlight: frontierIds.has(entry.card.id),
      }))
      const stairs = points.filter((point) => point.highlight).toSorted((a, b) => a.x - b.x)
      let path = ""
      for (const [index, point] of stairs.entries()) {
        path +=
          index === 0
            ? `M${String(point.x)},${String(point.y)}`
            : `H${String(point.x)}V${String(point.y)}`
      }
      return {
        points,
        path,
        area: "",
        baseline: { x: x(1), y: y(1) },
        xTicks: x.ticks(6),
        yTicks: y.ticks(5),
        x,
        y,
      }
    }

    const eligible = scored.filter((entry) => entry.tracks[mode].score !== null)
    const promoted = promotions(scored, mode, minImprovement)
    const promotedIds = new Set(promoted.map((promotion) => promotion.scored.card.id))
    // The baseline measurement anchors the time axis, so the chart is meaningful with zero
    // scorecards; give an empty axis a two-week window to read as a timeline.
    const origin = Date.parse(baselineDate)
    const times = [origin, ...scored.map((entry) => Date.parse(entry.card.submittedAt))]
    const start = Math.min(...times)
    const end = Math.max(Math.max(...times), start + 14 * 86_400_000)
    const scores = [1, ...eligible.map((entry) => entry.tracks[mode].score ?? 1)]
    const x = createScale("lin", [start, end], [0, innerWidth])
    // With nothing ranked, centre the baseline in a symmetric window instead of hugging an edge.
    const yDomain: [number, number] = eligible.length === 0 ? [0.8, 1.2] : extent(scores)
    const y = createScale(scaleKind, yDomain, [innerHeight, 0])
    const points: Point[] = eligible.map((entry) => ({
      scored: entry,
      x: x(Date.parse(entry.card.submittedAt)),
      y: y(entry.tracks[mode].score ?? 1),
      highlight: promotedIds.has(entry.card.id),
    }))
    // Leader staircase: hold the baseline (1×) until the first promotion, then each record.
    let path = `M${String(x(origin))},${String(y(1))}`
    for (const promotion of promoted.toReversed()) {
      path += `H${String(x(Date.parse(promotion.scored.card.submittedAt)))}V${String(y(promotion.score))}`
    }
    path += `H${String(innerWidth)}`
    return {
      points,
      path,
      area: `${path}V${String(innerHeight)}H${String(x(origin))}Z`,
      baseline: { x: x(origin), y: y(1) },
      xTicks: x.ticks(6),
      yTicks: y.ticks(5),
      x,
      y,
    }
  }, [scored, mode, scaleKind, innerWidth, innerHeight, minImprovement, baselineDate])

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    let best: Point | null = null
    let bestDistance = Infinity
    for (const point of model.points) {
      const distance = Math.hypot(point.x - px, (point.y - py) * 0.6)
      if (distance < bestDistance) {
        best = point
        bestDistance = distance
      }
    }
    setHover(bestDistance < 80 ? best : null)
  }

  const formatX = (value: number) =>
    mode === "pareto" ? formatRatio(value) : formatDate(new Date(value).toISOString())
  const formatY = (value: number) =>
    mode === "pareto" ? formatRatio(value) : `${formatNumber(value, 2)}×`
  const hoverScore =
    hover === null ? null : hover.scored.tracks[mode === "pareto" ? "balanced" : mode].score

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm">
            {mode === "pareto" ? "Time vs. memory frontier" : "Leader progression"}
          </p>
          <p className="text-xs text-fg-faint">{DESCRIPTIONS[mode]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            aria-label="Chart track"
            size="sm"
            value={mode}
            onValueChange={(value) => {
              setMode(value)
              setHover(null)
            }}
            options={MODES}
          />
          <SegmentedControl
            aria-label="Axis scale"
            size="sm"
            value={scaleKind}
            onValueChange={setScaleKind}
            options={[
              { value: "lin", label: "Lin" },
              { value: "log", label: "Log" },
            ]}
          />
        </div>
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 sm:grid-cols-2">
        {[METRICS.rTime, METRICS.rMemory].map((metric) => (
          <div key={metric.symbol} className="flex gap-3 text-xs">
            <dt className="shrink-0 text-fg">
              <Formula>{metric.symbol}</Formula>
            </dt>
            <dd className="text-fg-muted">
              <span className="text-fg">{metric.name}</span> relative to the baseline,{" "}
              {metric.direction}. {metric.hint}.
            </dd>
          </div>
        ))}
      </dl>

      <div ref={containerRef} className="relative mt-6 w-full" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            mode === "pareto"
              ? "Pareto frontier of command-time ratio against device-peak ratio, both relative to the baseline"
              : `${mode} track leader progression over time`
          }
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="chart-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ar-accent)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${String(MARGIN.left)},${String(MARGIN.top)})`}>
            {model.yTicks.map((tick) => (
              <g key={`y-${String(tick)}`} transform={`translate(0,${String(model.y(tick))})`}>
                <line x2={innerWidth} stroke="var(--ar-line)" />
                <text
                  x={-12}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-fg-faint font-mono text-[10px]"
                >
                  {formatY(tick)}
                </text>
              </g>
            ))}
            {model.xTicks.map((tick) => (
              <text
                key={`x-${String(tick)}`}
                x={model.x(tick)}
                y={innerHeight + 26}
                textAnchor="middle"
                className="fill-fg-faint font-mono text-[10px]"
              >
                {formatX(tick)}
              </text>
            ))}
            {/* Axis titles */}
            <text
              transform={`translate(${String(-MARGIN.left + 14)},${String(innerHeight / 2)}) rotate(-90)`}
              textAnchor="middle"
              className="fill-fg-muted text-[11px]"
            >
              <SvgFormula>
                {mode === "pareto"
                  ? `${METRICS.rTime.axis} (${METRICS.rTime.direction})`
                  : `${TRACK_AXIS[mode]} (higher is better)`}
              </SvgFormula>
            </text>
            <text
              x={innerWidth / 2}
              y={innerHeight + 52}
              textAnchor="middle"
              className="fill-fg-muted text-[11px]"
            >
              <SvgFormula>
                {mode === "pareto"
                  ? `${METRICS.rMemory.axis} (${METRICS.rMemory.direction})`
                  : "Date ranked"}
              </SvgFormula>
            </text>
            {mode === "pareto" ? (
              <text x={8} y={innerHeight - 10} className="fill-fg-faint font-mono text-[10px]">
                ↙ better on both
              </text>
            ) : null}

            {/* Baseline reference: the 1× line, or the (1, 1) point on the frontier. */}
            {mode === "pareto" ? (
              <g transform={`translate(${String(model.baseline.x)},${String(model.baseline.y)})`}>
                <circle r={4} fill="none" stroke="var(--ar-fg-faint)" strokeWidth={1.5} />
                <text x={8} dy="0.32em" className="fill-fg-faint font-mono text-[10px]">
                  baseline
                </text>
              </g>
            ) : (
              <g>
                <line
                  x2={innerWidth}
                  y1={model.baseline.y}
                  y2={model.baseline.y}
                  stroke="var(--ar-fg-faint)"
                  strokeDasharray="3 5"
                />
                <circle
                  cx={model.baseline.x}
                  cy={model.baseline.y}
                  r={4}
                  fill="var(--ar-bg)"
                  stroke="var(--ar-fg-muted)"
                  strokeWidth={1.5}
                />
                <text
                  x={model.baseline.x + 10}
                  y={model.baseline.y - 10}
                  className="fill-fg-muted font-mono text-[10px]"
                >
                  pinned baseline · 1.000× · measured {formatDate(baselineDate)}
                </text>
              </g>
            )}

            {model.area === "" ? null : (
              <motion.path
                key={`area-${mode}-${scaleKind}`}
                d={model.area}
                fill="url(#chart-area)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.4 }}
              />
            )}
            <motion.path
              key={`line-${mode}-${scaleKind}`}
              d={model.path}
              fill="none"
              stroke="var(--ar-accent)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, ease: [0.76, 0, 0.24, 1] }}
            />

            {model.points.map((point, index) => (
              <motion.circle
                key={point.scored.card.id}
                initial={false}
                animate={{ cx: point.x, cy: point.y, r: point.highlight ? 3 : 1.75 }}
                transition={{ type: "spring", stiffness: 160, damping: 22, delay: index * 0.004 }}
                fill={point.highlight ? "var(--ar-bg)" : "var(--ar-fg-faint)"}
                fillOpacity={point.highlight ? 1 : 0.35}
                stroke={point.highlight ? "var(--ar-accent)" : "none"}
                strokeWidth={1.5}
              />
            ))}

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
                  <line
                    x1={hover.x}
                    x2={hover.x}
                    y1={0}
                    y2={innerHeight}
                    stroke="var(--ar-line-strong)"
                  />
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
        </svg>

        {scored.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-6">
            <p className="max-w-md rounded-xl border border-line bg-bg/80 px-4 py-3 text-center text-sm text-fg-muted backdrop-blur">
              No ranked submissions yet. Every track starts at the pinned baseline (1.000×); the
              leader line moves when the first judge-signed scorecard lands.
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
                top: Math.max(0, hover.y + MARGIN.top - 96),
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <div className="flex items-center gap-2">
                <Avatar name={submitterOf(hover.scored.card.authors).handle} size="xs" />
                <span>{submitterOf(hover.scored.card.authors).handle}</span>
                {hover.highlight ? (
                  <span className="ml-auto text-fg-faint">
                    {mode === "pareto" ? "frontier" : "promoted"}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-fg-muted">{hover.scored.card.title}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 font-mono tabular">
                <div>
                  <dt className="text-fg-faint">
                    Time <Formula>R_T</Formula>
                  </dt>
                  <dd>{formatRatio(hover.scored.rTime)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">
                    Memory <Formula>R_M</Formula>
                  </dt>
                  <dd>{formatRatio(hover.scored.rMemory)}</dd>
                </div>
                <div>
                  <dt className="text-fg-faint">{mode === "pareto" ? "balanced" : mode}</dt>
                  <dd>{hoverScore === null ? "—" : formatScore(hoverScore)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-fg-faint">{formatDateTime(hover.scored.card.submittedAt)}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
