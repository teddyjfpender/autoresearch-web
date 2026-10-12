import type { ScriptChallenge } from "@/data/script/schema"
import { routes } from "@/lib/routes"
import { summarizeScripts } from "@/lib/script"

import { StatusBadge } from "../challenge/status-badge"
import { ShowcaseCard } from "./showcase-card"

/** A script challenge on the landing carousel: the score removed on its most improved track. */
export function ScriptCard({ challenge }: { challenge: ScriptChallenge }) {
  const lead = challenge.tracks
    .map((track) => ({ track, reduction: summarizeScripts(track).reduction }))
    .reduce<{ track: ScriptChallenge["tracks"][number]; reduction: number } | null>(
      (most, item) =>
        item.reduction !== null && (most === null || item.reduction > most.reduction)
          ? { track: item.track, reduction: item.reduction }
          : most,
      null,
    )
  const beaten = lead !== null && lead.reduction > 0
  return (
    <ShowcaseCard
      href={routes.challenge(challenge.slug)}
      status={<StatusBadge status={challenge.status} />}
      name={challenge.name}
      headline={challenge.headline}
      figure={beaten ? lead.reduction * 100 : null}
      label={
        beaten
          ? lead.track.provisional
            ? "below the paper's script, on the starting board"
            : "below the published baseline"
          : "No script has beaten the baseline yet"
      }
    />
  )
}
