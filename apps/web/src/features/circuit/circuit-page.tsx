import type { CircuitChallenge } from "@/data/circuit/schema"
import { getResearchActivity } from "@/lib/github-research"

import { DiscussionPanel } from "../board/discussion-panel"
import { CircuitDetails } from "./circuit-details"
import { CircuitList } from "./circuit-list"
import { CircuitView } from "./circuit-view"

/** A circuit challenge: one route, every track rendered and switched in place. */
export async function CircuitPage({ challenge }: { challenge: CircuitChallenge }) {
  const activity = await getResearchActivity(challenge.links.repo)
  const architectureNames = Object.fromEntries(
    challenge.architectures.map((item) => [item.id, item.name]),
  )
  const panels = Object.fromEntries(
    challenge.tracks.map((track) => [
      track.id,
      {
        circuitList: (
          <CircuitList
            circuits={track.board.front}
            architectureNames={architectureNames}
            repo={challenge.links.repo}
            best={track.board.best}
          />
        ),
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
