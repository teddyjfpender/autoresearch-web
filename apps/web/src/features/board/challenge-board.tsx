"use client"

import { Tabs, TabsPanel } from "@autoresearch/ui/components/tabs"
import { useEffect, useState, type ReactNode } from "react"

import type { Family, Track } from "@/data/schema"
import type { BucketId, Candidate, HistoryMilestone } from "@/lib/candidates"

import { registerTabs } from "../site/scroll"
import { CandidateTable } from "./candidate-table"
import { PerformanceChart, type ChartMode } from "./performance-chart"

export const BOARD_TABS = ["leaderboard", "proofs", "discussion", "details"] as const
export type BoardTab = (typeof BOARD_TABS)[number]
const BOARD_ROOT = "board"

const isTab = (value: string): value is BoardTab => BOARD_TABS.some((tab) => tab === value)

/**
 * The challenge page body: a chart and candidate leaderboard, with discussion and details one
 * tab away. Tab state mirrors the URL hash, so header links and shared URLs open the right tab.
 */
export function ChallengeBoard({
  candidates,
  families,
  tracks,
  baselineDate,
  history,
  historyBucket,
  rankedChart,
  discussion,
  details,
  proofs,
  discussionCount,
}: {
  candidates: readonly Candidate[]
  families: readonly Family[]
  tracks: readonly Track[]
  baselineDate: string
  /** Modeled milestones before the baseline, for the Cairo tab of the chart. */
  history: readonly HistoryMilestone[]
  /** The job tab the pre-baseline history belongs to. */
  historyBucket: BucketId
  /** The "what is being proved" panel. */
  proofs: ReactNode
  /** Signed-score chart, shown instead of the candidate chart once anything is ranked. */
  rankedChart: ReactNode
  discussion: ReactNode
  details: ReactNode
  discussionCount: number | null
}) {
  const [tab, setTab] = useState<BoardTab>("leaderboard")
  const [mode, setMode] = useState<ChartMode>("latency")
  // Job-type tabs follow the families' order, then the whole basket; Cairo proofs first.
  const [bucket, setBucket] = useState<BucketId>(families[0]?.id ?? "basket")
  const buckets: { value: BucketId; label: string }[] = [
    ...families.map((family) => ({ value: family.id, label: family.name })),
    { value: "basket", label: "All jobs" },
  ]
  const [selected, setSelected] = useState<number | null>(null)

  // Open the tab named in the URL, and let in-page links (#discussion, …) switch tabs.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (isTab(id)) setTab(id)
    }
    // Read the initial hash after hydration so server and client render the same first tab.
    const frame = requestAnimationFrame(fromHash)
    window.addEventListener("hashchange", fromHash)
    const unregister = registerTabs(BOARD_ROOT, BOARD_TABS, (id) => {
      if (isTab(id)) setTab(id)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", fromHash)
      unregister()
    }
  }, [])

  const select = (prNumber: number | null) => {
    setSelected(prNumber)
    if (prNumber === null) return
    requestAnimationFrame(() => {
      document
        .getElementById(`candidate-${String(prNumber)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  return (
    <div id={BOARD_ROOT} className="scroll-mt-24">
      <Tabs
        aria-label="Challenge"
        value={tab}
        onValueChange={(next) => {
          setTab(next)
          window.history.replaceState(null, "", `#${next}`)
        }}
        items={[
          { value: "leaderboard", label: "Leaderboard", meta: candidates.length },
          { value: "proofs", label: "Proofs" },
          {
            value: "discussion",
            label: "Discussion",
            ...(discussionCount === null ? {} : { meta: discussionCount }),
          },
          { value: "details", label: "Details" },
        ]}
      >
        <TabsPanel value="leaderboard" id="leaderboard" className="space-y-4">
          {rankedChart ?? (
            <PerformanceChart
              candidates={candidates}
              tracks={tracks}
              buckets={buckets}
              mode={mode}
              onModeChange={setMode}
              bucket={bucket}
              onBucketChange={setBucket}
              selected={selected}
              onSelect={select}
              baselineDate={baselineDate}
              history={history}
              historyBucket={historyBucket}
            />
          )}
          {candidates.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-8 text-fg-muted">
              No reviewed candidates yet. Open a PR with a candidate patch to appear here.
            </p>
          ) : (
            <CandidateTable
              candidates={candidates}
              families={families}
              tracks={tracks}
              mode={mode}
              bucket={bucket}
              selected={selected}
              onSelect={select}
            />
          )}
        </TabsPanel>
        <TabsPanel value="proofs" id="proofs">
          {proofs}
        </TabsPanel>
        <TabsPanel value="discussion" id="discussion">
          {discussion}
        </TabsPanel>
        <TabsPanel value="details" id="details">
          {details}
        </TabsPanel>
      </Tabs>
    </div>
  )
}
