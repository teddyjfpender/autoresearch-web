"use client"

import { Badge } from "@autoresearch/ui/components/badge"
import { Formula, SvgFormula } from "@autoresearch/ui/components/formula"
import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import type { Track, TrackId } from "@/data/schema"
import {
  ratiosFor,
  allDated,
  chronological,
  paretoIds,
  runningBest,
  scoreFor,
  type BucketId,
  type Candidate,
  type HistoryMilestone,
} from "@/lib/candidates"
import { formatDate, formatDateTime } from "@/lib/dates"
import { METRICS } from "@/lib/metrics"

import { createScale, extent } from "../chart/scales"

const HEIGHT = 300
const MARGIN = { top: 28, right: 28, bottom: 56, left: 72 }
const HISTORY_GAP = 32
/** Approximate advance of one 10px monospace glyph, for spacing milestone labels. */
const LABEL_GLYPH_PX = 6.2
/** Half the width of the first time tick ("Oct 2, 00:00"), which sits at the baseline. */
const FIRST_TIME_TICK_HALF_PX = 40

/** "hopper-v5" → "H5", "v33" stays "v33": compact milestone ticks; the full name is the title. */
function shortMilestone(label: string): string {
  const match = /^([a-z])[a-z]*-v?(\d+)$/i.exec(label)
  return match ? `${(match[1] ?? "").toUpperCase()}${match[2] ?? ""}` : label
}

export type ChartMode = TrackId | "pareto"

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

/** Ratio domain padded around its data, never narrower than ±5% so ticks stay readable. */
function ratioDomain(values: readonly number[]): [number, number] {
  const [lo, hi] = extent(values, 0.25)
  const half = Math.max((hi - lo) / 2, 0.05)
  const mid = (lo + hi) / 2
  return [mid - half, mid + half]
}

/** Enough decimals to tell neighbouring ticks apart. */
const tickDigits = (ticks: readonly number[]) => {
  const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1
  return step < 0.01 ? 3 : 2
}

const dateTimeShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})

interface Point {
  candidate: Candidate
  px: number
  py: number | null
  highlight: boolean
}

interface Model {
  points: Point[]
  history: {
    milestone: HistoryMilestone
    labeled: boolean
    tick: string
    px: number
    py: number
    lowY: number | null
    highY: number | null
  }[]
  path: string
  historyPath: string
  historyArea: string
  area: string
  baseline: { x: number; y: number }
  xTicks: { value: number; px: number; label: string }[]
  yTicks: number[]
  y: (value: number) => number
  timed: boolean
}

/**
 * Proof-time speedup over the pinned baseline, one tab per job type. Candidates are placed in
 * time; on the Cairo tab the modeled history sits to the left of the baseline. With more than
 * one scored track, a track switch and the R_T × R_M Pareto plane appear as well.
 */
export function PerformanceChart({
  candidates,
  tracks,
  buckets,
  mode,
  onModeChange,
  bucket,
  onBucketChange,
  selected,
  onSelect,
  baselineDate,
  history,
  historyBucket,
}: {
  candidates: readonly Candidate[]
  tracks: readonly Track[]
  buckets: readonly { value: BucketId; label: string }[]
  mode: ChartMode
  onModeChange: (mode: ChartMode) => void
  bucket: BucketId
  onBucketChange: (bucket: BucketId) => void
  selected: number | null
  onSelect: (prNumber: number) => void
  /** When the pinned baseline was measured (ISO date); anchors the time axis. */
  baselineDate: string
  /** Modeled milestones before the baseline, shown on the Cairo tab. */
  history: readonly HistoryMilestone[]
  historyBucket: BucketId
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const innerWidth = Math.max(200, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const multiTrack = tracks.length > 1
  const track = tracks.find((item) => item.id === mode) ?? tracks[0]

  const model = useMemo<Model>(() => {
    if (mode === "pareto") {
      const frontier = paretoIds(candidates, bucket)
      const measured = candidates.filter((candidate) => ratiosFor(candidate, bucket) !== null)
      const xs = [1, ...measured.map((candidate) => ratiosFor(candidate, bucket)?.rMemory ?? 1)]
      const ys = [1, ...measured.map((candidate) => ratiosFor(candidate, bucket)?.rTime ?? 1)]
      const x = createScale("lin", ratioDomain(xs), [0, innerWidth])
      const y = createScale("lin", ratioDomain(ys), [innerHeight, 0])
      const points: Point[] = measured.map((candidate) => {
        const ratios = ratiosFor(candidate, bucket)
        return {
          candidate,
          px: x(ratios?.rMemory ?? 1),
          py: y(ratios?.rTime ?? 1),
          highlight: frontier.has(candidate.prNumber),
        }
      })
      const stairs = [
        { px: x(1), py: y(1) },
        ...points
          .filter((point) => point.highlight)
          .map((point) => ({ px: point.px, py: point.py ?? 0 })),
      ].toSorted((a, b) => a.px - b.px)
      let path = ""
      for (const [index, point] of stairs.entries()) {
        path +=
          index === 0
            ? `M${String(point.px)},${String(point.py)}`
            : `H${String(point.px)}V${String(point.py)}`
      }
      const ticks = x.ticks(5)
      return {
        points,
        history: [],
        path,
        historyPath: "",
        historyArea: "",
        area: "",
        baseline: { x: x(1), y: y(1) },
        xTicks: ticks.map((value) => ({
          value,
          px: x(value),
          label: formatNumber(value, tickDigits(ticks)),
        })),
        yTicks: y.ticks(5),
        y,
        timed: false,
      }
    }

    const trackId = track?.id ?? "latency"
    const shownHistory = bucket === historyBucket ? history : []
    const ordered = chronological(candidates)
    const timed = allDated(ordered)

    // Horizontal layout: [history milestones] gap [baseline → candidates in time].
    const historyWidth =
      shownHistory.length === 0 ? 0 : Math.min(innerWidth * 0.38, shownHistory.length * 72)
    const startX = historyWidth === 0 ? 0 : historyWidth + HISTORY_GAP
    const times = ordered.map((candidate) => Date.parse(candidate.measuredAt ?? ""))
    const start = Math.min(Date.parse(baselineDate), ...(timed ? times : []))
    const end = timed ? Math.max(...times, start + 3_600_000) : 0
    const span = end - start
    const timeScale = createScale("lin", [start, end + span * 0.04], [startX, innerWidth])
    const step = ordered.length > 0 ? (innerWidth - startX) / ordered.length : 0
    const xFor = (index: number) =>
      timed ? timeScale(times[index] ?? start) : startX + (index + 1) * step

    const values = [
      ...ordered.flatMap((candidate) => {
        const value = scoreFor(candidate, trackId, bucket)
        return value === null ? [] : [value]
      }),
      ...shownHistory.flatMap((item) => [
        item.speedup,
        item.low ?? item.speedup,
        item.high ?? item.speedup,
      ]),
    ]
    // With history shown, the first milestone is the origin: 1.00× is where proving started, and
    // every later point (baseline included) reads as speedup since then.
    const base = shownHistory[0]?.speedup ?? 1
    const normalized = [1 / base, ...values.map((value) => value / base)]
    const lo = Math.min(1, ...normalized)
    const hi = Math.max(1, ...normalized)
    const pad = Math.max(0.02, (hi - lo) * 0.12)
    const floor = shownHistory.length > 0 ? 1 : Math.max(0, lo - pad)
    const scale = createScale("lin", [floor, hi + pad], [innerHeight, 0])
    const y = (value: number) => scale(value / base)

    const best = runningBest(ordered, trackId, bucket)
    let path = `M${String(startX)},${String(y(1))}`
    for (const [index, value] of best.entries()) {
      path += `H${String(xFor(index))}V${String(y(value))}`
    }
    path += `H${String(innerWidth)}`

    const historyStep = shownHistory.length > 1 ? historyWidth / (shownHistory.length - 1) : 0
    // Short tick labels, thinned so they never collide with each other or the first time tick.
    const shortLabels = shownHistory.map((item) => shortMilestone(item.label))
    const longest = Math.max(...shortLabels.map((label) => label.length), 3)
    const labelSpacing = longest * LABEL_GLYPH_PX + 16
    const labelEvery = historyStep > 0 ? Math.ceil(labelSpacing / historyStep) : 1
    const lastLabelX = startX - FIRST_TIME_TICK_HALF_PX - labelSpacing / 2
    const historyPoints = shownHistory.map((milestone, index) => ({
      milestone,
      tick: shortLabels[index] ?? milestone.label,
      labeled: index % labelEvery === 0 && index * historyStep <= lastLabelX,
      px: shownHistory.length === 1 ? historyWidth / 2 : index * historyStep,
      py: y(milestone.speedup),
      // Estimate whiskers below the origin are clipped to the axis.
      lowY: milestone.low === null ? null : Math.min(innerHeight, y(milestone.low)),
      highY: milestone.high === null ? null : Math.min(innerHeight, y(milestone.high)),
    }))
    const historyPath = historyPoints
      .map((point, index) => `${index === 0 ? "M" : "L"}${String(point.px)},${String(point.py)}`)
      .concat(historyPoints.length > 0 ? [`L${String(startX)},${String(y(1))}`] : [])
      .join("")

    const historyArea = historyPoints.length === 0 ? "" : `${historyPath}V${String(innerHeight)}H0Z`

    const tickCount = 4
    const xTicks = timed
      ? Array.from(
          { length: tickCount },
          (_, index) => start + (span * index) / (tickCount - 1),
        ).map((value) => ({
          value,
          px: timeScale(value),
          label:
            span <= 3 * 86_400_000
              ? dateTimeShort.format(new Date(value))
              : formatDate(new Date(value).toISOString()),
        }))
      : []

    return {
      points: ordered.map((candidate, index) => {
        const value = scoreFor(candidate, trackId, bucket)
        return {
          candidate,
          px: xFor(index),
          py: value === null ? null : y(value),
          highlight: value !== null && value === best[index] && value > 1,
        }
      }),
      history: historyPoints,
      path,
      historyPath,
      historyArea,
      area: `${path}V${String(innerHeight)}H${String(startX)}Z`,
      baseline: { x: startX, y: y(1) },
      xTicks,
      // Label the origin itself when the axis starts at the first milestone.
      yTicks:
        shownHistory.length > 0
          ? [floor, ...scale.ticks(5).filter((tick) => tick > floor + (hi + pad - floor) * 0.08)]
          : scale.ticks(5),
      y: scale,
      timed,
    }
  }, [
    candidates,
    mode,
    bucket,
    innerWidth,
    innerHeight,
    baselineDate,
    history,
    historyBucket,
    track,
  ])

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    let nearest: number | null = null
    let distance = Infinity
    for (const point of model.points) {
      const d =
        mode === "pareto" && point.py !== null
          ? Math.hypot(point.px - px, point.py - py)
          : Math.abs(point.px - px)
      if (d < distance) {
        distance = d
        nearest = point.candidate.prNumber
      }
    }
    setHover(distance < 40 ? nearest : null)
  }

  const hovered = model.points.find((point) => point.candidate.prNumber === hover)
  const bucketLabel = buckets.find((item) => item.value === bucket)?.label ?? ""
  const hoveredRatios = hovered ? ratiosFor(hovered.candidate, bucket) : null
  const hoveredScore = hovered
    ? scoreFor(hovered.candidate, mode === "pareto" ? (track?.id ?? "latency") : mode, bucket)
    : null
  const yTitle =
    mode === "pareto"
      ? `${METRICS.rTime.axis} (${METRICS.rTime.direction})`
      : model.history[0] === undefined
        ? `${track?.name ?? ""} speedup · ${track?.formula ?? ""}`
        : `${track?.name ?? ""} speedup since ${model.history[0].milestone.label}`
  const empty = candidates.every((candidate) => ratiosFor(candidate, bucket) === null)

  return (
    <figure className="rounded-2xl border border-line p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {mode === "pareto" ? "Time vs. memory frontier" : `${track?.name ?? ""} vs. baseline`}
            <Badge size="sm">unranked research</Badge>
          </p>
          <p className="mt-1 text-xs text-fg-faint">
            {mode === "pareto"
              ? "The line joins candidates nothing beats on both axes."
              : "Higher is faster. The line is the best candidate so far."}
          </p>
        </div>
        {multiTrack ? (
          <SegmentedControl
            aria-label="Chart track"
            size="sm"
            value={mode}
            onValueChange={(next) => {
              onModeChange(next)
              setHover(null)
            }}
            options={[
              ...tracks.map((item) => ({ value: item.id, label: item.name })),
              { value: "pareto" as const, label: "Pareto" },
            ]}
          />
        ) : null}
      </figcaption>

      <div className="mt-4 overflow-x-auto">
        <SegmentedControl
          aria-label="Proof job"
          size="sm"
          value={bucket}
          onValueChange={(next) => {
            onBucketChange(next)
            setHover(null)
          }}
          options={buckets}
        />
      </div>

      <div ref={containerRef} className="relative mt-4 w-full" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            mode === "pareto"
              ? `Proof time ratio against memory ratio for ${bucketLabel}`
              : `${track?.name ?? ""} speedup per candidate for ${bucketLabel}`
          }
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="perf-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ar-accent)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${String(MARGIN.left)},${String(MARGIN.top)})`}>
            {model.yTicks.map((tick) => (
              <g key={tick} transform={`translate(0,${String(model.y(tick))})`}>
                <line x2={innerWidth} stroke="var(--ar-line)" />
                <text
                  x={-12}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-fg-faint font-mono text-[10px]"
                >
                  {mode === "pareto"
                    ? formatNumber(tick, tickDigits(model.yTicks))
                    : `${formatNumber(tick, tickDigits(model.yTicks))}×`}
                </text>
              </g>
            ))}
            {model.xTicks.map((tick) => (
              <text
                key={tick.value}
                x={tick.px}
                y={innerHeight + 22}
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
              <SvgFormula>{yTitle}</SvgFormula>
            </text>
            {mode === "pareto" ? (
              <text
                x={innerWidth / 2}
                y={innerHeight + 48}
                textAnchor="middle"
                className="fill-fg-muted text-[11px]"
              >
                <SvgFormula>{`${METRICS.rMemory.axis} (${METRICS.rMemory.direction})`}</SvgFormula>
              </text>
            ) : null}

            {/* Baseline: the 1× line, or the (1, 1) corner of the Pareto plane. */}
            {mode === "pareto" ? null : (
              <line
                x2={innerWidth}
                y1={model.baseline.y}
                y2={model.baseline.y}
                stroke="var(--ar-fg-faint)"
                strokeDasharray="3 5"
              />
            )}

            {/* Earlier milestones lead into the baseline: the same line, hollow modeled points. */}
            {model.history.length === 0 ? null : (
              <g>
                <motion.path
                  key={`history-area-${bucket}`}
                  d={model.historyArea}
                  fill="url(#perf-area)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
                <motion.path
                  key={`history-${bucket}`}
                  d={model.historyPath}
                  fill="none"
                  stroke="var(--ar-accent)"
                  strokeWidth={1.5}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
                />
                {model.history.map((point) => (
                  <g key={point.milestone.label}>
                    {point.lowY === null || point.highY === null ? null : (
                      <line
                        x1={point.px}
                        x2={point.px}
                        y1={point.lowY}
                        y2={point.highY}
                        stroke="var(--ar-accent)"
                        strokeOpacity={0.25}
                        strokeWidth={6}
                        strokeLinecap="round"
                      />
                    )}
                    <circle
                      cx={point.px}
                      cy={point.py}
                      r={3.5}
                      fill="var(--ar-bg)"
                      stroke="var(--ar-accent)"
                      strokeWidth={1.5}
                    >
                      <title>{point.milestone.label}</title>
                    </circle>
                    {point.labeled ? (
                      <text
                        x={point.px}
                        y={innerHeight + 22}
                        textAnchor="middle"
                        className="fill-fg-faint font-mono text-[10px]"
                      >
                        {point.tick}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            )}

            <circle
              cx={model.baseline.x}
              cy={model.baseline.y}
              r={4}
              fill="var(--ar-bg)"
              stroke="var(--ar-fg-muted)"
              strokeWidth={1.5}
            />
            <text
              x={model.baseline.x + 8}
              y={model.baseline.y - 8}
              className="fill-fg-faint font-mono text-[10px]"
            >
              baseline
            </text>

            {model.area === "" ? null : (
              <motion.path
                key={`area-${mode}-${bucket}`}
                d={model.area}
                fill="url(#perf-area)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            )}
            <motion.path
              key={`line-${mode}-${bucket}`}
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
              const active =
                selected === point.candidate.prNumber || hover === point.candidate.prNumber
              const label = `#${String(point.candidate.prNumber)}`
              return (
                <g key={point.candidate.prNumber}>
                  {mode === "pareto" || model.timed || point.py === null ? null : (
                    <text
                      x={point.px}
                      y={innerHeight + 22}
                      textAnchor="middle"
                      className="fill-fg-faint font-mono text-[10px]"
                    >
                      {label}
                    </text>
                  )}
                  {point.py === null ? null : (
                    <>
                      <circle
                        cx={point.px}
                        cy={point.py}
                        r={active ? 6 : 4}
                        fill={point.highlight ? "var(--ar-accent)" : "var(--ar-bg)"}
                        stroke={point.highlight ? "var(--ar-bg)" : "var(--ar-fg-muted)"}
                        strokeWidth={point.highlight ? 2 : 1.5}
                      />
                      {mode === "pareto" || model.timed ? (
                        <text
                          {...(mode === "pareto" &&
                          Math.hypot(point.px - model.baseline.x, point.py - model.baseline.y) < 48
                            ? { x: point.px - 9, textAnchor: "end" }
                            : mode === "pareto"
                              ? { x: point.px + 9 }
                              : { x: point.px, textAnchor: "middle" })}
                          y={mode === "pareto" ? point.py + 3 : point.py - 10}
                          className="fill-fg-faint font-mono text-[10px]"
                        >
                          {label}
                        </text>
                      ) : null}
                    </>
                  )}
                </g>
              )
            })}

            <rect
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              className={hover === null ? "" : "cursor-pointer"}
              onPointerMove={onMove}
              onPointerLeave={() => {
                setHover(null)
              }}
              onClick={() => {
                if (hover !== null) onSelect(hover)
              }}
            />
          </g>
        </svg>

        {empty ? (
          <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-fg-muted">
            {candidates.length === 0
              ? "No reviewed candidates yet. The baseline holds."
              : `No candidate has a proof-only time for every ${bucketLabel.toLowerCase()} job yet.`}
          </p>
        ) : null}

        <AnimatePresence>
          {hovered ? (
            <motion.div
              key="tip"
              className="pointer-events-none absolute z-10 w-64 rounded-xl border border-line-strong bg-surface-strong/95 p-3 text-xs shadow-2xl backdrop-blur"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: Math.min(width - 264, Math.max(0, hovered.px + MARGIN.left + 14)),
                top: MARGIN.top,
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <p className="text-fg">
                #{hovered.candidate.prNumber} · {hovered.candidate.title}
              </p>
              {hoveredRatios === null ? (
                <p className="mt-2 text-fg-faint">{bucketLabel}: not every job timed</p>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-2 font-mono tabular">
                  <div>
                    <dt className="text-fg-faint">
                      <Formula>R_T</Formula>
                    </dt>
                    <dd>{formatNumber(hoveredRatios.rTime, 3)}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-faint">vs. baseline</dt>
                    <dd>{hoveredScore === null ? "—" : `${formatNumber(hoveredScore, 3)}×`}</dd>
                  </div>
                </dl>
              )}
              {hovered.candidate.measuredAt === null ? null : (
                <p className="mt-2 text-fg-faint">
                  {hovered.candidate.timeSource === "commit" ? "Head commit" : "PR opened"}{" "}
                  {formatDateTime(hovered.candidate.measuredAt)}
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {model.history.length === 0 ? null : (
        <ul
          className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-faint"
          aria-label="Legend"
        >
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            measured
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full border border-accent" />
            modeled
          </li>
        </ul>
      )}
    </figure>
  )
}
