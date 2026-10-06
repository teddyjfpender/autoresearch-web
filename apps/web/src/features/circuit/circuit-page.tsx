import type { CircuitChallenge } from "@/data/circuit/schema"
import { getResearchActivity } from "@/lib/github-research"

import { DiscussionPanel } from "../board/discussion-panel"
import { CircuitDetails } from "./circuit-details"
import { CircuitView } from "./circuit-view"

/** A circuit challenge: one route, every track rendered and switched in place. */
export async function CircuitPage({ challenge }: { challenge: CircuitChallenge }) {
  const activity = await getResearchActivity(challenge.links.repo)
  const panels = Object.fromEntries(
    challenge.tracks.map((track) => [
      track.id,
      {
        details: <CircuitDetails challenge={challenge} track={track} />,
      },
    ]),
  )
  return (
    <CircuitView
      challenge={challenge}
      panels={panels}
      discussionCount={activity.discussions?.length ?? null}
      discussion={
        <DiscussionPanel
          activity={activity}
          discussionsUrl={challenge.links.discussions}
          pullsUrl={`${challenge.links.repo}/pulls`}
        />
      }
    />
  )
}
