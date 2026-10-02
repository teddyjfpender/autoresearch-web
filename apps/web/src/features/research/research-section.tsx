import { Avatar } from "@autoresearch/ui/components/avatar"
import { Container, Eyebrow, Heading, Section } from "@autoresearch/ui/components/layout"
import { Reveal } from "@autoresearch/ui/motion/reveal"
import { ArrowUpRight } from "lucide-react"

import type { ResearchActivity, ResearchItem } from "@/lib/github-research"
import type { ResearchCase, ResearchReview } from "@/data/schema"

const reviewLabel: Record<ResearchReview["reviewState"], string> = {
  changes_requested: "Changes requested",
  research_only: "Research only",
  ready_to_judge: "Queued for judge",
  promoted_direct: "Promoted H200 research",
}
const EMPTY_REVIEWS: readonly ResearchReview[] = []

function ResearchList({
  title,
  items,
  href,
  reviews = EMPTY_REVIEWS,
}: {
  title: string
  items: readonly ResearchItem[] | null
  href: string
  reviews?: readonly ResearchReview[]
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
        <h3 className="text-2xl tracking-tight">{title}</h3>
        <a href={href} target="_blank" rel="noreferrer" className="text-label hover:text-fg">
          View on GitHub <ArrowUpRight className="ml-1 inline size-3" />
        </a>
      </div>
      {items === null ? (
        <p className="py-6 text-sm text-fg-muted">
          The live feed is unavailable. GitHub has the current activity.
        </p>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-fg-muted">No activity yet. Start a thread on GitHub.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const review = reviews.find((entry) => entry.prNumber === item.number)
            const current = review?.headSha === item.headSha
            return (
              <li key={item.number} className="py-5">
                <a href={item.url} target="_blank" rel="noreferrer" className="group block">
                  <p className="text-label">
                    #{item.number} · {item.detail} · Updated {item.updatedAt.slice(0, 10)}
                  </p>
                  <h4 className="mt-1.5 text-lg group-hover:text-accent">{item.title}</h4>
                  {review ? (
                    <p className="mt-2 text-sm text-accent">
                      {current ? reviewLabel[review.reviewState] : "New commit; review pending"}
                    </p>
                  ) : null}
                  {item.excerpt !== "" ? (
                    <p className="mt-2 line-clamp-3 text-sm text-fg-muted">{item.excerpt}</p>
                  ) : null}
                  {review && current ? (
                    <p className="mt-2 text-xs text-fg-muted">{review.validation}</p>
                  ) : null}
                  {item.author ? (
                    <span className="mt-3 inline-flex items-center gap-2 text-xs text-fg-faint">
                      <Avatar name={item.author.login} src={item.author.avatarUrl} size="xs" />
                      {item.author.login}
                    </span>
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ResearchSection({
  activity,
  reviews,
  measurements,
  repositoryUrl,
  discussionsUrl,
}: {
  activity: ResearchActivity
  reviews: readonly ResearchReview[]
  measurements: readonly ResearchCase[]
  repositoryUrl: string
  discussionsUrl: string
}) {
  return (
    <Section id="research" className="border-t border-line">
      <Container>
        <Reveal>
          <Eyebrow index="03">Open research</Eyebrow>
          <Heading className="mt-6 max-w-[20ch]">
            Ideas and patches, <em className="font-display font-normal">in the open.</em>
          </Heading>
          <p className="mt-5 max-w-3xl text-fg-muted">
            Pull requests and Discussions come from the challenge repository. The measurements below
            distinguish author reports from independent H200 checks. A ranked result still requires
            isolated judging and a signed receipt.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <ResearchList
            title="Reviewable PRs"
            items={activity.pulls}
            href={`${repositoryUrl}/pulls`}
            reviews={reviews}
          />
          <ResearchList
            title="Research Discussions"
            items={activity.discussions}
            href={discussionsUrl}
          />
        </div>
        {measurements.length > 0 ? (
          <div className="mt-14 border-t border-line pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-2xl tracking-tight">Direct H200 research measurements</h3>
              <div className="flex flex-wrap gap-4">
                <a
                  href={`${repositoryUrl}/blob/main/data/reports/submission-research-2026-10-02.tsv`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label text-accent hover:underline"
                >
                  Per-case TSV <ArrowUpRight className="ml-1 inline size-3" />
                </a>
                <a
                  href={`${repositoryUrl}/blob/main/data/reports/submission-h200-runs-2026-10-02.tsv`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label text-accent hover:underline"
                >
                  Per-run H200 TSV <ArrowUpRight className="ml-1 inline size-3" />
                </a>
                <a
                  href={`${repositoryUrl}/blob/main/data/reports/submission-pow-primitives-2026-10-02.tsv`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label text-accent hover:underline"
                >
                  PoW primitive TSV <ArrowUpRight className="ml-1 inline size-3" />
                </a>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-fg-muted">
              These public, unsandboxed runs are research evidence, not signed scores. Command time
              is launch to exit; Cairo proof time ends at proof.finish. PR #3 and PR #6 were
              independently checked on H200 against canonical proofs and Rust verifiers. PR #4
              retains its author-reported PoW and full-command measurements.
            </p>
            <div className="mt-6 grid gap-4">
              {reviews
                .filter((review) => measurements.some((row) => row.prNumber === review.prNumber))
                .toSorted((a, b) =>
                  a.reviewState === "promoted_direct" && b.reviewState !== "promoted_direct"
                    ? -1
                    : b.reviewState === "promoted_direct" && a.reviewState !== "promoted_direct"
                      ? 1
                      : b.prNumber - a.prNumber,
                )
                .map((review) => {
                  const rows = measurements.filter((row) => row.prNumber === review.prNumber)
                  return (
                    <details
                      key={review.prNumber}
                      open={review.reviewState === "promoted_direct"}
                      className="rounded-2xl border border-line p-5"
                    >
                      <summary className="cursor-pointer text-label">
                        PR #{review.prNumber} · {reviewLabel[review.reviewState]} · at least{" "}
                        {review.publicSamplesPerArm} sample
                        {review.publicSamplesPerArm === 1 ? "" : "s"} per arm
                      </summary>
                      <p className="mt-3 text-sm text-fg-muted">{review.decision}</p>
                      <a
                        href={`${repositoryUrl}/pull/${String(review.prNumber)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-label text-accent hover:underline"
                      >
                        Review PR #{review.prNumber} <ArrowUpRight className="ml-1 inline size-3" />
                      </a>
                      <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-xs">
                          <thead className="border-b border-line text-fg-muted">
                            <tr>
                              <th className="py-2 pr-4">Public case</th>
                              <th className="py-2 pr-4">Command B → C (s)</th>
                              <th className="py-2 pr-4">C/B command</th>
                              <th className="py-2 pr-4">Command improvement</th>
                              <th className="py-2 pr-4">Ingress B → C (s)</th>
                              <th className="py-2 pr-4">Cairo execute/finish B → C (s)</th>
                              <th className="py-2">Peak B → C (GiB, rounded)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {rows.map((row) => (
                              <tr key={row.caseId}>
                                <td className="py-2 pr-4 font-mono">{row.caseId}</td>
                                <td className="py-2 pr-4 tabular-nums">
                                  {row.baselineCommandS.toFixed(3)} →{" "}
                                  {row.candidateCommandS.toFixed(3)}
                                </td>
                                <td className="py-2 pr-4 tabular-nums">
                                  {(
                                    row.medianPairedCommandRatio ??
                                    row.candidateCommandS / row.baselineCommandS
                                  ).toFixed(3)}
                                  {row.medianPairedCommandRatio === null ? " single" : " paired"}
                                </td>
                                <td className="py-2 pr-4 tabular-nums">
                                  {(
                                    (1 -
                                      (row.medianPairedCommandRatio ??
                                        row.candidateCommandS / row.baselineCommandS)) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </td>
                                <td className="py-2 pr-4 tabular-nums">
                                  {row.baselineIngressS === null || row.candidateIngressS === null
                                    ? "—"
                                    : `${row.baselineIngressS.toFixed(3)} → ${row.candidateIngressS.toFixed(3)}`}
                                </td>
                                <td className="py-2 pr-4 tabular-nums">
                                  {row.baselineProofS === null || row.candidateProofS === null
                                    ? "—"
                                    : `${row.baselineProofS.toFixed(3)} → ${row.candidateProofS.toFixed(3)}`}
                                </td>
                                <td className="py-2 tabular-nums">
                                  {row.baselinePeakGiBRounded.toFixed(2)} →{" "}
                                  {row.candidatePeakGiBRounded.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )
                })}
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  )
}
