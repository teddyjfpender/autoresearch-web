import { ArrowUpRight } from "lucide-react"

import type { getIngressStudy } from "@/data/source"

type Study = Awaited<ReturnType<typeof getIngressStudy>>

const percentReduction = (before: number, after: number) =>
  `${((1 - after / before) * 100).toFixed(1)}%`

export function IngressStudy({ rows }: { rows: Study }) {
  if (rows.length === 0) return null

  const cohorts = (["two-distinct", "four-distinct"] as const).map((cohort) => {
    const baseline = rows.find((row) => row.cohort === cohort && row.variant === "baseline")
    const candidate = rows.find((row) => row.cohort === cohort && row.variant === "candidate")
    if (!baseline || !candidate) throw new Error(`Missing ingress study pair: ${cohort}`)
    return { baseline, candidate }
  })

  return (
    <section
      aria-labelledby="ingress-study-title"
      className="mt-8 rounded-2xl border border-line p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label">Upstream prover research · unranked</p>
          <h2 id="ingress-study-title" className="mt-2 text-2xl tracking-tight">
            H200 ingress study · PR #212
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            Fresh leaf commands on distinct PIEs. The command timer includes ingress, proving and
            wrap. These inputs differ from the ten-case challenge basket, so this study does not
            change the score or the improvement chart.
          </p>
        </div>
        <a
          href="https://github.com/teddyjfpender/stwo-cuda-challenge/blob/main/data/reports/README.md#upstream-cuda-ingress-pr-212-2026-10-03"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Receipts and method <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[610px] text-left text-sm tabular">
          <thead className="border-b border-line text-fg-faint">
            <tr>
              <th scope="col" className="py-3 pr-4 font-normal">
                PIEs
              </th>
              <th scope="col" className="px-4 py-3 font-normal">
                Full command
              </th>
              <th scope="col" className="px-4 py-3 font-normal">
                Cairo ingress
              </th>
              <th scope="col" className="py-3 pl-4 font-normal">
                Device peak
              </th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map(({ baseline, candidate }) => (
              <tr key={baseline.cohort} className="border-b border-line last:border-0">
                <th scope="row" className="py-4 pr-4 font-medium">
                  {baseline.pieCount} distinct
                </th>
                <td className="px-4 py-4">
                  {baseline.meanCommandS.toFixed(3)} → {candidate.meanCommandS.toFixed(3)} s
                  <span className="ml-2 text-accent">
                    −{percentReduction(baseline.meanCommandS, candidate.meanCommandS)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {baseline.meanIngressS.toFixed(3)} → {candidate.meanIngressS.toFixed(3)} s
                  <span className="ml-2 text-accent">
                    −{percentReduction(baseline.meanIngressS, candidate.meanIngressS)}
                  </span>
                </td>
                <td className="py-4 pl-4">{(candidate.peakDeviceBytes / 1e9).toFixed(2)} GB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-fg-faint">
        Two ABBA samples per arm; exact proof hashes matched. No warm service or 4,096-PIE latency
        is implied.
      </p>
    </section>
  )
}
