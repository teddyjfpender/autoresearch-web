import type { Challenge, ResearchCase, ResearchReview } from "@/data/schema"

interface Point {
  pr: number
  pie: number | null
  basket: number | null
  title: string
}

function inverseGeometricMean(rows: readonly ResearchCase[]): number {
  return Math.exp(
    -rows.reduce(
      (sum, row) =>
        sum +
        Math.log(row.medianPairedCommandRatio ?? row.candidateCommandS / row.baselineCommandS),
      0,
    ) / rows.length,
  )
}

function pointsFor(
  challenge: Challenge,
  reviews: readonly ResearchReview[],
  measurements: readonly ResearchCase[],
): Point[] {
  const expected = new Map(
    (["pie", "recursion", "pipeline"] as const).map((family) => [
      family,
      challenge.cases
        .filter((testCase) => testCase.family === family)
        .map((testCase) => testCase.id),
    ]),
  )
  return reviews
    .toSorted((a, b) => a.prNumber - b.prNumber)
    .map((review) => {
      const rows = measurements.filter(
        (row) => row.prNumber === review.prNumber && row.headSha === review.headSha,
      )
      const byFamily = (["pie", "recursion", "pipeline"] as const).map((family) => {
        const found = rows.filter((row) => row.family === family)
        const ids = expected.get(family) ?? []
        return found.length === ids.length &&
          ids.every((id) => found.some((row) => row.caseId === id))
          ? inverseGeometricMean(found)
          : null
      })
      const basket = byFamily.every((value) => value !== null)
        ? Math.exp(byFamily.reduce((sum, value) => sum + Math.log(value), 0) / 3)
        : null
      return { pr: review.prNumber, pie: byFamily[0] ?? null, basket, title: review.title }
    })
}

/** Public research trend; incomplete baskets never masquerade as full scores. */
export function ResearchProgressChart({
  challenge,
  reviews,
  measurements,
}: {
  challenge: Challenge
  reviews: readonly ResearchReview[]
  measurements: readonly ResearchCase[]
}) {
  const points = pointsFor(challenge, reviews, measurements)
  if (points.length === 0) return null
  const plot = [{ pr: 0, pie: 1, basket: 1, title: "Pinned baseline" }, ...points]
  const allValues = plot.flatMap((point) => [point.pie, point.basket].filter((v) => v !== null))
  const low = Math.min(0.98, ...allValues) - 0.02
  const high = Math.max(1.02, ...allValues) + 0.02
  const x = (index: number) => 65 + (index * 650) / (plot.length - 1)
  const y = (score: number) => 210 - ((score - low) / (high - low)) * 170
  const ticks = [0, 1, 2, 3, 4].map((index) => low + (index * (high - low)) / 4)
  const line = (key: "pie" | "basket") =>
    plot.flatMap((point, index) =>
      point[key] === null
        ? []
        : [{ x: x(index), y: y(point[key]), pr: point.pr, value: point[key] }],
    )
  const pieLine = line("pie")
  const basketLine = line("basket")

  return (
    <figure className="rounded-2xl border border-line p-5 sm:p-7">
      <figcaption>
        <p className="text-label text-accent">Reviewed research · unranked</p>
        <h2 className="mt-2 text-xl tracking-tight sm:text-2xl">Improvement by PR</h2>
        <p className="mt-2 max-w-3xl text-sm text-fg-muted">
          Inverse full-command latency relative to each PR’s paired baseline; 1× is unchanged. The
          PIE line uses all six public PIEs. The full-basket line also includes both fold and both
          pipeline cases; PR #3 has no fold measurements, so it has no full-basket point.
        </p>
      </figcaption>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-fg-muted">
        <span>
          <span className="mr-2 inline-block h-0.5 w-5 bg-accent align-middle" />
          Full basket
        </span>
        <span>
          <span className="mr-2 inline-block h-0.5 w-5 bg-fg-muted align-middle" />
          Six PIEs
        </span>
      </div>
      <svg
        viewBox="0 0 760 270"
        className="mt-4 h-auto w-full"
        role="img"
        aria-label="Research improvement line chart by PR, showing six-PIE and complete-basket inverse latency"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1="65" x2="715" y1={y(tick)} y2={y(tick)} stroke="var(--ar-line)" />
            <text x="55" y={y(tick) + 4} textAnchor="end" fill="var(--ar-fg-faint)" fontSize="11">
              {tick.toFixed(2)}×
            </text>
          </g>
        ))}
        {[
          { key: "pie", values: pieLine, color: "var(--ar-fg-muted)" },
          { key: "basket", values: basketLine, color: "var(--ar-accent)" },
        ].map((series) => (
          <g key={series.key}>
            <polyline
              fill="none"
              stroke={series.color}
              strokeWidth="2.5"
              points={series.values
                .map((point) => `${String(point.x)},${String(point.y)}`)
                .join(" ")}
            />
            {series.values.map((point) => (
              <circle
                key={point.pr}
                cx={point.x}
                cy={point.y}
                r="5"
                fill="var(--ar-bg)"
                stroke={series.color}
                strokeWidth="2"
              >
                <title>{`${series.key === "pie" ? "Six PIEs" : "Full basket"}, ${point.pr === 0 ? "baseline" : `PR #${String(point.pr)}`}: ${point.value.toFixed(3)}×`}</title>
              </circle>
            ))}
          </g>
        ))}
        {plot.map((point, index) => (
          <text
            key={point.pr}
            x={x(index)}
            y="250"
            textAnchor="middle"
            fill="var(--ar-fg-muted)"
            fontSize="12"
          >
            {point.pr === 0 ? "Baseline" : `PR #${String(point.pr)}`}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-xs text-fg-muted">
        {points.map((point) => (
          <a
            key={point.pr}
            href={`${challenge.links.repo}/pull/${String(point.pr)}`}
            className="hover:text-accent"
          >
            PR #{point.pr}: PIE {point.pie?.toFixed(3) ?? "—"}× · full{" "}
            {point.basket?.toFixed(3) ?? "incomplete"}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-fg-faint">
        Source: reviewed H200 research rows in the challenge repository. These are not signed judge
        scores; the separate ranked leaderboard remains gated.
      </p>
    </figure>
  )
}
