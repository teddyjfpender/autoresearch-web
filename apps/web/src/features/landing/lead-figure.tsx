"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { createContext, use, useMemo, useState, type ReactNode } from "react"

type LeadMode = "improvement" | "time"

const LeadModeContext = createContext<{ mode: LeadMode; setMode: (mode: LeadMode) => void }>({
  mode: "improvement",
  setMode: () => {
    // No provider: the default mode stays fixed.
  },
})

/** Shares one "improvement % ↔ current best" choice across every challenge card. */
export function LeadModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LeadMode>("improvement")
  const value = useMemo(() => ({ mode, setMode }), [mode])
  return <LeadModeContext value={value}>{children}</LeadModeContext>
}

export function LeadModeSwitch() {
  const { mode, setMode } = use(LeadModeContext)
  return (
    <SegmentedControl
      aria-label="Card figure"
      size="sm"
      value={mode}
      onValueChange={setMode}
      options={[
        { value: "improvement" as const, label: "Improvement %" },
        { value: "time" as const, label: "Current best" },
      ]}
    />
  )
}

export interface LeadFigureProps {
  improvement: { value: number; label: string }
  /** Per-job proof seconds, or null when no baseline is published for this host. */
  time: { seconds: number | null; label: string }
  /** A challenge whose best is not a duration (e.g. a gate-qubit product) shows this instead. */
  alternate?: { value: number; fractionDigits: number; suffix: string; label: string }
}

/** A card's lead number: counts up whenever it appears or the mode changes. */
export function LeadFigure({ improvement, time, alternate }: LeadFigureProps) {
  const { mode } = use(LeadModeContext)
  const showTime = mode === "time"
  const milliseconds = time.seconds !== null && time.seconds < 1
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
      <p className="text-[clamp(2.75rem,5vw,4.25rem)] leading-[0.85] font-light tracking-[-0.06em] text-accent tabular">
        {showTime ? (
          alternate ? (
            <NumberTicker
              key="alternate"
              value={alternate.value}
              fractionDigits={alternate.fractionDigits}
              suffix={alternate.suffix}
            />
          ) : time.seconds === null ? (
            "—"
          ) : (
            <NumberTicker
              key="time"
              value={milliseconds ? time.seconds * 1000 : time.seconds}
              fractionDigits={milliseconds ? 0 : time.seconds < 10 ? 2 : 1}
              suffix={milliseconds ? " ms" : " s"}
            />
          )
        ) : (
          <NumberTicker key="improvement" value={improvement.value} suffix="%" />
        )}
      </p>
      <p className="max-w-[14rem] pb-1 text-sm leading-snug text-fg-muted">
        {showTime ? (alternate?.label ?? time.label) : improvement.label}
      </p>
    </div>
  )
}
