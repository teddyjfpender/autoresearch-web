"use client"

import { Container } from "@autoresearch/ui/components/layout"
import { useEffect, useState, type ReactNode } from "react"

import type { CircuitChallenge } from "@/data/circuit/schema"

import { FemocoAbout } from "./about/femoco-about"
import { CircuitBoard } from "./circuit-board"
import { CircuitHero } from "./circuit-hero"
import { TrackSwitcher } from "./track-switcher"

const TRACK_PARAM = "track"

/**
 * A circuit challenge on one route. The selected track drives the hero figures and the whole
 * board; it is mirrored in `?track=` so a link opens the same track, while the page itself stays
 * statically rendered with the first track.
 */
export function CircuitView({
  challenge,
  panels,
  discussion,
  discussionCount,
}: {
  challenge: CircuitChallenge
  /** Server-rendered per-track panels, keyed by track id. */
  panels: Readonly<Record<string, { details: ReactNode }>>
  discussion: ReactNode
  discussionCount: number | null
}) {
  const [trackId, setTrackId] = useState(challenge.tracks[0]?.id ?? "")
  const track = challenge.tracks.find((item) => item.id === trackId) ?? challenge.tracks[0]

  // Open the track named in the URL after hydration, so server and client agree on first paint.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(TRACK_PARAM)
    if (requested === null || !challenge.tracks.some((item) => item.id === requested)) return
    const frame = requestAnimationFrame(() => {
      setTrackId(requested)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [challenge.tracks])

  if (track === undefined) return null
  const select = (next: string) => {
    setTrackId(next)
    const url = new URL(window.location.href)
    url.searchParams.set(TRACK_PARAM, next)
    window.history.replaceState(null, "", url)
  }

  return (
    <>
      <CircuitHero
        challenge={challenge}
        track={track}
        switcher={
          <TrackSwitcher tracks={challenge.tracks} value={track.id} onValueChange={select} />
        }
      />
      <Container className="pb-24">
        <CircuitBoard
          // A fresh board per track: its selected architecture belongs to that track.
          key={track.id}
          board={track.board}
          circuits={track.circuits}
          registry={challenge.architectures}
          targets={track.targets}
          about={
            challenge.slug === "femoco"
              ? {
                  label: "About FeMoco",
                  panel: <FemocoAbout board={track.board} targets={track.targets} />,
                }
              : null
          }
          discussionCount={discussionCount}
          discussion={discussion}
          details={panels[track.id]?.details}
        />
      </Container>
    </>
  )
}
