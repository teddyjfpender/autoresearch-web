import { Container } from "@autoresearch/ui/components/layout"

import type { CircuitChallenge } from "@/data/circuit/schema"
import { getResearchActivity } from "@/lib/github-research"

import { DiscussionPanel } from "../board/discussion-panel"
import { CircuitBoard } from "./circuit-board"
import { CircuitDetails } from "./circuit-details"
import { CircuitHero } from "./circuit-hero"
import { CircuitList } from "./circuit-list"

/** One track of a circuit challenge: hero, then the board. */
export async function CircuitPage({ challenge }: { challenge: CircuitChallenge }) {
  const activity = await getResearchActivity(challenge.links.repo)
  const architectureNames = Object.fromEntries(
    challenge.architectures.map((item) => [item.id, item.name]),
  )
  return (
    <>
      <CircuitHero challenge={challenge} />
      <Container className="pb-24">
        <CircuitBoard
          board={challenge.board}
          circuits={challenge.circuits}
          registry={challenge.architectures}
          targets={challenge.targets}
          circuitList={
            <CircuitList
              circuits={challenge.board.front}
              architectureNames={architectureNames}
              repo={challenge.links.repo}
              best={challenge.board.best}
            />
          }
          discussionCount={activity.discussions?.length ?? null}
          discussion={
            <DiscussionPanel
              activity={activity}
              discussionsUrl={challenge.links.discussions}
              pullsUrl={`${challenge.links.repo}/pulls`}
            />
          }
          details={<CircuitDetails challenge={challenge} />}
        />
      </Container>
    </>
  )
}
