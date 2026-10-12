"use client"

import { Tabs, TabsPanel } from "@autoresearch/ui/components/tabs"
import { useEffect, useState, type ReactNode } from "react"

import type { ScriptArchitecture, ScriptTrack } from "@/data/script/schema"

import { registerTabs } from "../site/scroll"
import { ArchitectureTable } from "./architecture-table"
import { ScriptChart, type ScriptChartMode } from "./script-chart"

export const SCRIPT_TABS = ["leaderboard", "discussion", "details"] as const
type ScriptTab = (typeof SCRIPT_TABS)[number]
const BOARD_ROOT = "board"

const isTab = (value: string): value is ScriptTab => SCRIPT_TABS.some((tab) => tab === value)

/**
 * A script track's page body. The leaderboard is by architecture, with every instance on the
 * chart; discussion and details are one tab away. Tab state mirrors the URL hash, as on the
 * other challenge pages.
 */
export function ScriptBoard({
  track,
  registry,
  discussion,
  details,
  discussionCount,
}: {
  track: ScriptTrack
  registry: readonly ScriptArchitecture[]
  discussion: ReactNode
  details: ReactNode
  discussionCount: number | null
}) {
  const [tab, setTab] = useState<ScriptTab>("leaderboard")
  // A starting board was measured at one moment, so only the trade-off view says anything.
  const [mode, setMode] = useState<ScriptChartMode>(track.provisional ? "frontier" : "history")
  // With one architecture on the board there is nothing to choose between: show its scripts.
  const [selected, setSelected] = useState<string | null>(
    track.architectures.length === 1 ? (track.architectures[0]?.id ?? null) : null,
  )
  const architectureNames = Object.fromEntries(registry.map((item) => [item.id, item.name]))

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (isTab(id)) setTab(id)
    }
    const frame = requestAnimationFrame(fromHash)
    window.addEventListener("hashchange", fromHash)
    const unregister = registerTabs(BOARD_ROOT, SCRIPT_TABS, (id) => {
      if (isTab(id)) setTab(id)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", fromHash)
      unregister()
    }
  }, [])

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
          { value: "leaderboard", label: "Architectures", meta: track.architectures.length },
          {
            value: "discussion",
            label: "Discussion",
            ...(discussionCount === null ? {} : { meta: discussionCount }),
          },
          { value: "details", label: "Details" },
        ]}
      >
        <TabsPanel value="leaderboard" id="leaderboard" className="space-y-4">
          {track.provisional ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-fg-muted sm:px-6">
              These are the instances the board starts from, measured by the challenge&apos;s
              evaluator on public lanes. The judge has not recorded them yet, so they are not ledger
              rows and may be re-validated.
            </p>
          ) : null}
          <ScriptChart
            instances={track.instances}
            front={track.front}
            history={track.history}
            baseline={track.baseline}
            floorBits={track.floorBits}
            architectureNames={architectureNames}
            selected={selected}
            mode={mode}
            onModeChange={track.provisional ? null : setMode}
          />
          {track.architectures.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-8 text-fg-muted">
              No validated instances yet. Open a submission pull request to appear here.
            </p>
          ) : (
            <ArchitectureTable
              rows={track.architectures}
              registry={registry}
              baseline={track.baseline}
              selected={selected}
              onSelect={setSelected}
            />
          )}
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
