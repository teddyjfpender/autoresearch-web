"use client"

import { useState } from "react"

import type { Challenge, ResearchCase, ResearchReview } from "@/data/schema"

/** Reviewed direct research, kept distinct from signed ranked receipts. */
export function ResearchComparisonChart({
  challenge,
  reviews,
  measurements,
}: {
  challenge: Challenge
  reviews: readonly ResearchReview[]
  measurements: readonly ResearchCase[]
}) {
  const available = reviews.filter((review) =>
    measurements.some((row) => row.prNumber === review.prNumber && row.headSha === review.headSha),
  )
  const [selected, setSelected] = useState(
    available.find((review) => review.reviewState === "promoted_direct")?.prNumber ??
      available[0]?.prNumber,
  )
  const review = available.find((item) => item.prNumber === selected) ?? available[0]
  if (!review) return null

  const rows = challenge.cases.flatMap((testCase) => {
    const measured = measurements.find(
      (row) =>
        row.prNumber === review.prNumber &&
        row.headSha === review.headSha &&
        row.caseId === testCase.id,
    )
    return measured ? [{ ...measured, title: testCase.title }] : []
  })

  return (
    <figure className="rounded-2xl border border-line p-5 sm:p-7">
      <figcaption className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label text-accent">Reviewed H200 research</p>
          <h2 className="mt-2 text-xl tracking-tight sm:text-2xl">
            Full-command time, before and after
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Every reviewed PR with direct measurements is shown, including regressions. These runs
            are unranked; the signed leaderboard has a separate judge.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-label text-fg-muted">
          Research PR
          <select
            aria-label="Research PR"
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg"
            value={review.prNumber}
            onChange={(event) => {
              setSelected(Number(event.target.value))
            }}
          >
            {available.map((item) => (
              <option key={item.prNumber} value={item.prNumber}>
                #{item.prNumber} ·{" "}
                {item.reviewState === "promoted_direct" ? "promoted research" : "research only"}
              </option>
            ))}
          </select>
        </label>
      </figcaption>
      <p className="mt-5 text-sm text-fg-muted">
        <a
          className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent"
          href={`${challenge.links.repo}/pull/${String(review.prNumber)}`}
        >
          {review.title}
        </a>{" "}
        · {review.validation}
      </p>
      <ul className="mt-6 divide-y divide-line border-t border-line">
        {rows.map((row) => {
          const ratio = row.medianPairedCommandRatio ?? row.candidateCommandS / row.baselineCommandS
          const change = (ratio - 1) * 100
          const largest = Math.max(row.baselineCommandS, row.candidateCommandS)
          return (
            <li
              key={row.caseId}
              className="grid gap-3 py-3 sm:grid-cols-[12rem_1fr_5rem] sm:items-center"
            >
              <span className="text-sm">
                <span className="mr-2 font-mono text-[0.65rem] text-fg-faint uppercase">
                  {row.family}
                </span>
                {row.title}
              </span>
              <div
                className="space-y-1.5"
                aria-label={`Baseline ${row.baselineCommandS.toFixed(2)} seconds; candidate ${row.candidateCommandS.toFixed(2)} seconds`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[0.65rem] text-fg-faint">B</span>
                  <span
                    className="h-2 rounded-full bg-line-strong"
                    style={{ width: `${String((row.baselineCommandS / largest) * 100)}%` }}
                  />
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular">
                    {row.baselineCommandS.toFixed(2)} s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[0.65rem] text-fg-faint">C</span>
                  <span
                    className={`h-2 rounded-full ${change <= 0 ? "bg-accent" : "bg-orange-400"}`}
                    style={{ width: `${String((row.candidateCommandS / largest) * 100)}%` }}
                  />
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular">
                    {row.candidateCommandS.toFixed(2)} s
                  </span>
                </div>
              </div>
              <span
                className={`text-right font-mono text-sm tabular ${change <= 0 ? "text-accent" : "text-orange-400"}`}
              >
                {change > 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-fg-faint">
        B = the paired pinned baseline; C = this PR candidate. Each pair has its own scale. The
        percentage uses the median paired ratio when available. {review.decision}
      </p>
    </figure>
  )
}
