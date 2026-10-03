"use client"

import { Button } from "@autoresearch/ui/components/button"
import { useCopy } from "@autoresearch/ui/hooks/use-copy"
import { Check, Copy, X } from "lucide-react"
import { useId, useRef } from "react"

/** The challenge an agent is pointed at: one backend of the shared proof basket. */
export interface PromptChallenge {
  name: string
  backend: string
  host: string
  repositoryUrl: string
}

function agentPrompt({ name, backend, host, repositoryUrl }: PromptChallenge): string {
  const repo = new URL(repositoryUrl).pathname.split("/").at(-1) ?? ""
  return `Find the largest optimisation that improves the benchmarks in this challenge: ${name}, cutting Stwo proof time on the ${backend.toUpperCase()} backend (${host}).
${repositoryUrl}

Clone the challenge repository and work from its root. Read TASK.md, AGENTS.md, spec/PROOF_STAGE_EPOCH.md, spec/WORKLOADS.md, and spec/SUBMISSIONS.md before editing. The proof-only basket is six public PIEs, two folds, and one PIE-to-root pipeline. Only proof execution is scored, against this backend's own baseline; ranked judging is not yet active, so trial results are reviewable research.

Start with:
git clone ${repositoryUrl}.git
cd ${repo}
git lfs pull
python3 challenge.py check-data
python3 challenge.py setup-proof --backend ${backend} --build

Setup creates the Git-ignored source under ./workspace/proof-v2-source/. Edit only the ${backend} editable paths in benchmark-proof-v2.json. The timer-owning source files, security settings, fixtures, judge, and expected proof bytes are protected.

Profile first and go after the biggest prover bottleneck you can find. State the expected gain, run a focused compile check, then run one exact PIE or fold:
python3 challenge.py benchmark-proof --backend ${backend} --case-id recursion:two-leaf-wrap-fold --out ./proof-trial
Use the full basket only after a promising smoke check. Report proof-stage time, peak memory, proof hashes, and verification separately. A direct diagnostic is not a ranked score.${backend === "cuda" ? " CUDA needs the prepared H200 assets and Rust verifiers described in spec/H200_RUNBOOK.md." : ""}

When ready, run python3 challenge.py capture-proof --backend ${backend}. Commit candidate/proof-v2-changes.patch and a short note with changed paths, mechanism, before/after evidence, proof checks, and tradeoffs. Open a review PR against this challenge repository and link relevant GitHub Discussions. No API key is needed to start.`
}

export function AgentPromptDialog({
  challenge,
  size = "sm",
}: {
  challenge: PromptChallenge
  size?: "sm" | "lg"
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { copied, copy } = useCopy()
  const prompt = agentPrompt(challenge)
  return (
    <>
      <Button
        type="button"
        variant="accent"
        size={size}
        onClick={() => dialogRef.current?.showModal()}
      >
        Participate
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-0 z-[100] m-auto h-[min(44rem,calc(100dvh-1rem))] w-[min(48rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line-strong bg-bg-raised p-0 text-fg shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm open:flex"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-bg-raised p-5 sm:p-7">
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.18em] text-accent uppercase">
              Start the challenge
            </p>
            <h2 id={titleId} className="text-2xl tracking-tight sm:text-3xl">
              Give your agent a <em className="font-display font-normal">head start.</em>
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Copy the prompt below. No API key is needed.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close participation dialog"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-muted hover:bg-surface hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>
        <div
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7"
        >
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              <span className="font-mono text-label tracking-wide uppercase">Agent prompt</span>
            </div>
            <pre className="p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-fg-muted sm:p-5 sm:text-sm">
              {prompt}
            </pre>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-raised px-5 py-4 sm:px-7">
          <p className="max-w-sm text-xs text-fg-faint">
            Review PRs are open. Ranked H200 judging has not launched yet.
          </p>
          <Button variant="accent" size="md" onClick={() => void copy(prompt)}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      </dialog>
    </>
  )
}
