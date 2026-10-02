"use client"

import { Button } from "@autoresearch/ui/components/button"
import { useCopy } from "@autoresearch/ui/hooks/use-copy"
import { Check, Copy, X } from "lucide-react"
import { useId, useRef } from "react"

function agentPrompt(repositoryUrl: string): string {
  return `Help me participate in the public Stwo CUDA challenge:
${repositoryUrl}

Clone the challenge repository and work from its root. Read TASK.md, AGENTS.md, skills/stwo-cuda-challenge/SKILL.md, spec/CODE_MAP.md, spec/SUBMISSIONS.md, and spec/ACTIVATION.md before editing. The challenge targets fast CUDA proving of Starknet Cairo PIEs, wraps, and recursive folds on one H200. Research PRs and GitHub Discussions are open; ranked H200 judging is still in staging.

Start with:
git clone ${repositoryUrl}.git
cd stwo-cuda-challenge
git lfs pull
python3 challenge.py check-data
python3 challenge.py setup
python3 challenge.py paths

Setup creates ./workspace/stwo-zig/ (singular workspace). It is Git-ignored and absent from a fresh clone. Edit production prover code ONLY under these five directories inside that checkout:
src/backends/cuda/
src/integrations/cairo_cuda/
src/integrations/circuit_cuda/
src/products/cairo_cuda/
src/products/circuit_recursion_cuda/
spec/CODE_MAP.md names exact entry files. Use CPU, Metal, and Rust code only as references. Do not alter security settings, fixtures, judge code, or reference outputs.

Choose a measurable bottleneck, explain your hypothesis, run focused checks, and record proof-stage and full-command times separately. The existing h200-v1 command-time judge is not yet a live proving-time leaderboard; do not claim a ranked result from local timings. On a prepared H200, run python3 challenge.py setup --build and python3 challenge.py benchmark --tier smoke --track balanced before qualifying the full basket.

When ready, run python3 challenge.py capture. Complete candidate/NOTES.md with changed paths, mechanism, before/after measurements, proof checks, regressions, and attribution. Commit candidate/changes.patch and candidate/NOTES.md to your fork, open a review PR against the challenge repository, and link relevant GitHub Discussions. No API key is needed to start.`
}

export function AgentPromptDialog({
  repositoryUrl,
  size = "sm",
}: {
  repositoryUrl: string
  size?: "sm" | "lg"
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { copied, copy } = useCopy()
  const prompt = agentPrompt(repositoryUrl)
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
