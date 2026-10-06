"use client"

import { Tabs, TabsPanel } from "@autoresearch/ui/components/tabs"
import { useEffect, useState, type ReactNode } from "react"

import type {
  Circuit,
  CircuitArchitecture,
  CircuitTarget,
  CircuitTrackBoard,
} from "@/data/circuit/schema"

import { registerTabs } from "../site/scroll"
import { ArchitectureTable } from "./architecture-table"
import { CircuitChart, type CircuitChartMode } from "./circuit-chart"

export const CIRCUIT_TABS = ["leaderboard", "circuits", "discussion", "details"] as const
type CircuitTab = (typeof CIRCUIT_TABS)[number]
const BOARD_ROOT = "board"

const isTab = (value: string): value is CircuitTab => CIRCUIT_TABS.some((tab) => tab === value)

/**
 * A circuit track's page body. The leaderboard is by architecture, with every circuit on the
 * chart; the circuit-level front, discussion and details are one tab away. Tab state mirrors
 * the URL hash, as on the other challenge pages.
 */
export function CircuitBoard({
  board,
  circuits,
  registry,
  targets,
  circuitList,
  discussion,
  details,
  discussionCount,
}: {
  board: CircuitTrackBoard
  circuits: readonly Circuit[]
  registry: readonly CircuitArchitecture[]
  targets: readonly CircuitTarget[]
  circuitList: ReactNode
  discussion: ReactNode
  details: ReactNode
  discussionCount: number | null
}) {
  const [tab, setTab] = useState<CircuitTab>("leaderboard")
  const [mode, setMode] = useState<CircuitChartMode>("frontier")
  const [selected, setSelected] = useState<string | null>(null)
  const architectureNames = Object.fromEntries(registry.map((item) => [item.id, item.name]))

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (isTab(id)) setTab(id)
    }
    const frame = requestAnimationFrame(fromHash)
    window.addEventListener("hashchange", fromHash)
    const unregister = registerTabs(BOARD_ROOT, CIRCUIT_TABS, (id) => {
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
          { value: "leaderboard", label: "Architectures", meta: board.architectures.length },
          { value: "circuits", label: "Front", meta: board.front.length },
          {
            value: "discussion",
            label: "Discussion",
            ...(discussionCount === null ? {} : { meta: discussionCount }),
          },
          { value: "details", label: "Details" },
        ]}
      >
        <TabsPanel value="leaderboard" id="leaderboard" className="space-y-4">
          <CircuitChart
            circuits={circuits}
            front={board.front}
            history={board.history}
            targets={targets}
            baseline={board.baseline ?? null}
            architectureNames={architectureNames}
            selected={selected}
            mode={mode}
            onModeChange={setMode}
          />
          {board.architectures.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-8 text-fg-muted">
              No validated circuits yet. Open a submission pull request to appear here.
            </p>
          ) : (
            <ArchitectureTable
              rows={board.architectures}
              registry={registry}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </TabsPanel>
        <TabsPanel value="circuits" id="circuits">
          {circuitList}
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
