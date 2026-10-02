import { ArrowUpRight } from "lucide-react"

import type { ResearchHighlight as Highlight } from "@/lib/research-summary"

import { SectionLink } from "../site/section-link"

export function ResearchHighlight({
  highlight,
  repositoryUrl,
}: {
  highlight: Highlight
  repositoryUrl: string
}) {
  const { review } = highlight
  return (
    <aside
      className="rounded-2xl border border-accent bg-surface p-5 sm:p-7"
      aria-label="Latest validated H200 research"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label text-accent">
            Latest validated H200 research · PR #{review.prNumber}
          </p>
          <h2 className="mt-2 text-xl tracking-tight sm:text-2xl">{review.title}</h2>
        </div>
        <a
          href={`${repositoryUrl}/pull/${String(review.prNumber)}`}
          target="_blank"
          rel="noreferrer"
          className="text-label text-accent hover:underline"
        >
          View PR <ArrowUpRight className="ml-1 inline size-3" />
        </a>
      </div>
      <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-3">
        <div>
          <p className="text-3xl font-light tracking-tight text-accent tabular">
            {Math.round(highlight.pieReductionMin * 100)}–
            {Math.round(highlight.pieReductionMax * 100)}%
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            lower whole-command time on all {highlight.pieCount} public PIEs
          </p>
        </div>
        <div>
          <p className="text-3xl font-light tracking-tight tabular">
            +{(highlight.fullBasketGain * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-fg-muted">equal-family direct inverse-latency gain</p>
        </div>
        <div>
          <p className="text-3xl font-light tracking-tight">Ingress</p>
          <p className="mt-1 text-sm text-fg-muted">
            fixed-asset work overlapped; Cairo proof execution stayed near baseline
          </p>
        </div>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-fg-faint">
        {review.decision} Reviewed commit {review.headSha.slice(0, 8)}.{" "}
        <SectionLink href="#research" className="text-accent hover:underline">
          See per-case measurements
        </SectionLink>
        .
      </p>
    </aside>
  )
}
