"use client"

import { useState } from "react"

import type { ProofProgress } from "@/data/schema"

interface Point {
  label: string
  kind: ProofProgress["kind"]
  seconds: number
  low: number | null
  high: number | null
  order: number
  method: string
  prNumber: number | null
}

/** One proof-stage timeline, normalized onto the same six current public PIE inputs. */
export function ProofHistoryChart({ rows }: { rows: readonly ProofProgress[] }) {
  const [selected, setSelected] = useState<number | null>(null)
  const groups = new Map<string, ProofProgress[]>()
  for (const row of rows) {
    const key = `${String(row.order)}:${row.kind}:${row.milestone}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const points: Point[] = [...groups.values()]
    .map((group) => {
      const first = group[0]
      if (!first) throw new Error("Empty proof-progress group")
      const mean = (values: readonly number[]) =>
        Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
      return {
        label: first.milestone,
        kind: first.kind,
        seconds: mean(group.map((row) => row.proofS)),
        low: group.every((row) => row.lowS !== null)
          ? mean(group.map((row) => row.lowS ?? 1))
          : null,
        high: group.every((row) => row.highS !== null)
          ? mean(group.map((row) => row.highS ?? 1))
          : null,
        order: first.order,
        method: first.method,
        prNumber: first.prNumber,
      }
    })
    .toSorted((a, b) => a.order - b.order)
  if (points.length === 0) return null

  const width = 900
  const height = 300
  const left = 58
  const right = 24
  const top = 28
  const bottom = 48
  const baseline =
    points.find((point) => point.kind === "challenge_baseline")?.seconds ??
    points.at(-1)?.seconds ??
    1
  const max = Math.max(...points.map((point) => point.seconds)) * 1.08
  const x = (index: number) =>
    left + (index / Math.max(1, points.length - 1)) * (width - left - right)
  const y = (seconds: number) => top + (1 - seconds / max) * (height - top - bottom)
  const path = (kind: Point["kind"]) =>
    points
      .flatMap((point, index) =>
        point.kind === kind ? [`${String(x(index))},${String(y(point.seconds))}`] : [],
      )
      .join(" ")
  const active = points[selected ?? points.length - 1]
  const firstMeasured = points.findIndex((point) => point.kind !== "historical_model")
  const measuredStart = Math.max(0, firstMeasured - 1)

  return (
    <section
      className="rounded-2xl border border-line-strong bg-surface p-5 md:p-7"
      aria-label="PIE proving progress"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">PIE proving progress</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Geometric mean proof execution across the same six public PIEs; lower is faster.
          </p>
        </div>
        <span className="text-sm text-fg-muted">
          Current measured baseline {baseline.toFixed(2)} s
        </span>
      </div>
      <svg
        className="mt-5 w-full"
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="img"
        aria-label="Historical modeled proof stages followed by measured baseline and PR research"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const seconds = max * fraction
          return (
            <g key={fraction}>
              <line
                x1={left}
                x2={width - right}
                y1={y(seconds)}
                y2={y(seconds)}
                stroke="currentColor"
                className="text-line-strong"
                opacity="0.4"
              />
              <text
                x={left - 10}
                y={y(seconds) + 4}
                textAnchor="end"
                fontSize="12"
                fill="currentColor"
                className="text-fg-muted"
              >
                {seconds.toFixed(1)}s
              </text>
            </g>
          )
        })}
        <polyline
          points={path("historical_model")}
          fill="none"
          stroke="currentColor"
          className="text-fg-muted"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <polyline
          points={points
            .slice(measuredStart)
            .map(
              (point, index) => `${String(x(index + measuredStart))},${String(y(point.seconds))}`,
            )
            .join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth="2"
          opacity="0.75"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.label}:${point.kind}`}
            cx={x(index)}
            cy={y(point.seconds)}
            r={selected === index ? 6 : 4}
            fill="currentColor"
            className={point.kind === "historical_model" ? "text-fg-muted" : "text-accent"}
            onFocus={() => {
              setSelected(index)
            }}
            onMouseEnter={() => {
              setSelected(index)
            }}
            onClick={() => {
              setSelected(index)
            }}
            tabIndex={0}
            aria-label={`${point.label}: ${point.seconds.toFixed(3)} seconds, ${point.kind}`}
          />
        ))}
        <text x={left} y={height - 10} fill="currentColor" className="text-fg-muted" fontSize="12">
          Historical modeled
        </text>
        <text
          x={width - right}
          y={height - 10}
          textAnchor="end"
          fill="currentColor"
          className="text-fg-muted"
          fontSize="12"
        >
          Challenge PRs
        </text>
      </svg>
      {active && (
        <p className="mt-2 text-sm text-fg-muted">
          <strong className="text-fg">
            {active.label}: {active.seconds.toFixed(3)} s.
          </strong>{" "}
          {active.kind === "historical_model"
            ? `Statistical estimate transferred from four older PIE receipts${active.low !== null && active.high !== null ? ` (source-model interval ${active.low.toFixed(2)}–${active.high.toFixed(2)} s)` : ""}; not a measured proof of these six PIEs.`
            : active.kind === "challenge_baseline"
              ? "Measured direct H200 baseline; unranked."
              : `Direct PR #${active.prNumber === null ? "?" : String(active.prNumber)} research measurement; unranked.`}
        </p>
      )}
      <p className="mt-2 text-xs text-fg-muted">
        Historical milestones are modeled on current inputs and shown with a dashed line. PR points
        are measured proof-stage diagnostics; the chart is not a ranked leaderboard.
      </p>
    </section>
  )
}
