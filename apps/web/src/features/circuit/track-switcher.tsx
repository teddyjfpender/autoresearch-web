"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"

import type { CircuitTrack } from "@/data/circuit/schema"

/** Switches between the tracks of one circuit challenge without leaving its page. */
export function TrackSwitcher({
  tracks,
  value,
  onValueChange,
}: {
  tracks: readonly CircuitTrack[]
  value: string
  onValueChange: (track: string) => void
}) {
  if (tracks.length < 2) return null
  return (
    <SegmentedControl
      aria-label="Track"
      size="sm"
      value={value}
      onValueChange={onValueChange}
      options={tracks.map((track) => ({ value: track.id, label: track.name }))}
    />
  )
}
