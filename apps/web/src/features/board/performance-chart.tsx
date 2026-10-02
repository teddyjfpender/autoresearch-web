"use client"

import { Formula, SvgFormula } from "@autoresearch/ui/components/formula"
import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import type { Track, TrackId } from "@/data/schema"
import { paretoIds, runningBest, scoreFor, type BucketId, type Candidate } from "@/lib/candidates"
import { METRICS } from "@/lib/metrics"

import { createScale, extent } from "../chart/scales"

const HEIGHT = 300
const MARGIN = { top: 24, right: 28, bottom: 56, left: 72 }

export type ChartMode = TrackId | "pareto"

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

interface Point {
  candidate: Candidate
  px: number
  py: number | null
  highlight: boolean
}

/**
 * Reviewed candidates scored like the judge: latency 1/R_T, memory 1/R_M, balanced
 * 1/√(R_T·R_M), or the R_T × R_M Pareto plane, for the whole basket or one job type.
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
  timeScope,
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
  timeScope: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const innerWidth = Math.max(200, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const track = tracks.find((item) => item.id === mode)

  const model = useMemo(() => {
    if (mode === "pareto") {
      const frontier = paretoIds(candidates, bucket)
      const measured = candidates.filter((candidate) => candidate.buckets[bucket] !== null)
      const xs = [1, ...measured.map((candidate) => candidate.buckets[bucket]?.rMemory ?? 1)]
      const ys = [1, ...measured.map((candidate) => candidate.buckets[bucket]?.rTime ?? 1)]
      const x = createScale("lin", ratioDomain(xs), [0, innerWidth])
      const y = createScale("lin", ratioDomain(ys), [innerHeight, 0])
      const points: Point[] = measured.map((candidate) => {
        const ratios = candidate.buckets[bucket]
        return {
          candidate,
          px: x(ratios?.rMemory ?? 1),
          py: y(ratios?.rTime ?? 1),
          highlight: frontier.has(candidate.prNumber),
        }
      })
      // Staircase through the frontier, anchored at the baseline corner.
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
      return {
        points,
        path,
        area: "",
        baseline: { x: x(1), y: y(1) },
        xTicks: x.ticks(5),
        yTicks: y.ticks(5),
        x,
        y,
      }
    }

    const slots = candidates.length + 1
    const step = slots > 1 ? innerWidth / (slots - 1) : 0
    const xAt = (slot: number) => slot * step
    const values = candidates.flatMap((candidate) => {
      const value = scoreFor(candidate, mode, bucket)
      return value === null ? [] : [value]
    })
    const lo = Math.min(1, ...values)
    const hi = Math.max(1, ...values)
    const pad = Math.max(0.02, (hi - lo) * 0.15)
    const y = createScale("lin", [lo - pad, hi + pad], [innerHeight, 0])
    const best = runningBest(candidates, mode, bucket)
    let path = `M${String(xAt(0))},${String(y(1))}`
    for (const [index, value] of best.entries()) {
      path += `H${String(xAt(index + 1))}V${String(y(value))}`
    }
    const points: Point[] = candidates.map((candidate, index) => {
      const value = scoreFor(candidate, mode, bucket)
      return {
        candidate,
        px: xAt(index + 1),
        py: value === null ? null : y(value),
        highlight: value !== null && value === best[index] && value > 1,
      }
    })
    return {
      points,
      path,
      area: `${path}V${String(innerHeight)}H${String(xAt(0))}Z`,
      baseline: { x: xAt(0), y: y(1) },
      xTicks: [] as number[],
      yTicks: y.ticks(5),
      x: xAt,
      y,
    }
  }, [candidates, mode, bucket, innerWidth, innerHeight])

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
    setHover(distance < 48 ? nearest : null)
  }

  const hovered = model.points.find((point) => point.candidate.prNumber === hover)
  const bucketLabel = buckets.find((item) => item.value === bucket)?.label ?? ""
  const hoveredRatios = hovered ? hovered.candidate.buckets[bucket] : null
  const hoveredScore = hovered
    ? scoreFor(hovered.candidate, mode === "pareto" ? "balanced" : mode, bucket)
    : null
  const yTitle =
    mode === "pareto"
      ? `${METRICS.rTime.axis} (${METRICS.rTime.direction})`
      : `${track?.name ?? ""} score · ${track?.formula ?? ""} (higher is better)`

  return (
    <figure className="rounded-2xl border border-line p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-sm">
            {mode === "pareto" ? "Time vs. memory frontier" : `${track?.name ?? ""} vs. baseline`}
            <span className="text-fg-faint"> · {bucketLabel}</span>
          </p>
          <p className="text-xs text-fg-faint">
            {mode === "pareto"
              ? "Each dot is a reviewed candidate; the line joins those nothing beats on both axes."
              : "Each dot is a reviewed candidate PR; the line is the best so far."}{" "}
            {timeScope} Unranked direct measurements, not signed scores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <SegmentedControl
            aria-label="Job type"
            size="sm"
            value={bucket}
            onValueChange={onBucketChange}
            options={buckets}
          />
        </div>
      </figcaption>

      <dl className="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 sm:grid-cols-2">
        {[METRICS.rTime, METRICS.rMemory].map((metric) => (
          <div key={metric.symbol} className="flex gap-3 text-xs">
            <dt className="shrink-0 text-fg">
              <Formula>{metric.symbol}</Formula>
            </dt>
            <dd className="text-fg-muted">
              <span className="text-fg">{metric.name}</span> ÷ baseline, {metric.direction}.
            </dd>
          </div>
        ))}
      </dl>

      <div ref={containerRef} className="relative mt-4 w-full" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            mode === "pareto"
              ? `Proving time ratio against memory ratio for ${bucketLabel}`
              : `${track?.name ?? ""} score per reviewed candidate for ${bucketLabel}`
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
                key={tick}
                x={model.x(tick)}
                y={innerHeight + 22}
                textAnchor="middle"
                className="fill-fg-faint font-mono text-[10px]"
              >
                {formatNumber(tick, tickDigits(model.xTicks))}
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
            <circle
              cx={model.baseline.x}
              cy={model.baseline.y}
              r={4}
              fill="var(--ar-bg)"
              stroke="var(--ar-fg-muted)"
              strokeWidth={1.5}
            />
            <text
              x={model.baseline.x + (mode === "pareto" ? 8 : 0)}
              y={mode === "pareto" ? model.baseline.y - 8 : innerHeight + 22}
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
              return (
                <g key={point.candidate.prNumber}>
                  {mode === "pareto" ? null : (
                    <text
                      x={point.px}
                      y={innerHeight + 22}
                      textAnchor="middle"
                      className="fill-fg-faint font-mono text-[10px]"
                    >
                      #{point.candidate.prNumber}
                    </text>
                  )}
                  {point.py === null ? (
                    <text
                      x={point.px}
                      y={innerHeight + 36}
                      textAnchor="middle"
                      className="fill-fg-faint text-[9px]"
                    >
                      not measured
                    </text>
                  ) : (
                    <>
                      <circle
                        cx={point.px}
                        cy={point.py}
                        r={active ? 6 : 4}
                        fill={point.highlight ? "var(--ar-accent)" : "var(--ar-bg)"}
                        stroke={point.highlight ? "var(--ar-bg)" : "var(--ar-fg-muted)"}
                        strokeWidth={point.highlight ? 2 : 1.5}
                      />
                      {mode === "pareto" ? (
                        <text
                          // Flip the label left when it would collide with the baseline's.
                          {...(Math.hypot(
                            point.px - model.baseline.x,
                            point.py - model.baseline.y,
                          ) < 48
                            ? { x: point.px - 9, textAnchor: "end" }
                            : { x: point.px + 9 })}
                          y={point.py + 3}
                          className="fill-fg-faint font-mono text-[10px]"
                        >
                          #{point.candidate.prNumber}
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

        {candidates.every((candidate) => candidate.buckets[bucket] === null) ? (
          <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-fg-muted">
            No reviewed candidate has measured every {bucketLabel.toLowerCase()} case yet.
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
                <p className="mt-2 text-fg-faint">{bucketLabel}: not every case measured</p>
              ) : (
                <dl className="mt-2 grid grid-cols-3 gap-2 font-mono tabular">
                  <div>
                    <dt className="text-fg-faint">
                      <Formula>R_T</Formula>
                    </dt>
                    <dd>{formatNumber(hoveredRatios.rTime, 3)}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-faint">
                      <Formula>R_M</Formula>
                    </dt>
                    <dd>{formatNumber(hoveredRatios.rMemory, 3)}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-faint">
                      {mode === "pareto" ? "balanced" : (track?.name.toLowerCase() ?? "")}
                    </dt>
                    <dd>{hoveredScore === null ? "—" : `${formatNumber(hoveredScore, 3)}×`}</dd>
                  </div>
                </dl>
              )}
              <p className="mt-2 text-fg-faint">Click to open its breakdown</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </figure>
  )
}
