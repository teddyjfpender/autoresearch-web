import type { ScriptChallenge } from "@/data/script/schema"
import { getResearchActivity } from "@/lib/github-research"

import { DiscussionPanel } from "../board/discussion-panel"
import { ScriptDetails } from "./script-details"
import { ScriptView } from "./script-view"

/** A script challenge: one route, every track rendered and switched in place. */
export async function ScriptPage({ challenge }: { challenge: ScriptChallenge }) {
  const activity = await getResearchActivity(challenge.links.repo)
  const panels = Object.fromEntries(
    challenge.tracks.map((track) => [
      track.id,
      {
        details: <ScriptDetails challenge={challenge} track={track} />,
      },
    ]),
  )
  return (
    <ScriptView
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
