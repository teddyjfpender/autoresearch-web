import type { CircuitChallenge } from "@/data/circuit/schema"
import { summarizeCircuits } from "@/lib/circuit"
import { routes } from "@/lib/routes"

import { StatusBadge } from "../challenge/status-badge"
import { ShowcaseCard } from "./showcase-card"

/** A circuit challenge on the landing carousel: the score removed on its most improved track. */
export function CircuitCard({ challenge }: { challenge: CircuitChallenge }) {
  const summaries = challenge.tracks.map((track) => summarizeCircuits(track))
  const lead = summaries.reduce<(typeof summaries)[number] | null>(
    (most, item) =>
      item.reduction !== null && (most === null || item.reduction > (most.reduction ?? 0))
        ? item
        : most,
    null,
  )
  const reduction = lead?.reduction ?? null
  return (
    <ShowcaseCard
      href={routes.challenge(challenge.slug)}
      status={<StatusBadge status={challenge.status} />}
      name={challenge.name}
      headline={challenge.headline}
      figure={reduction === null || reduction <= 0 ? null : reduction * 100}
      label={
        reduction === null || reduction <= 0
          ? "No circuit has beaten the baseline yet"
          : lead?.reference?.kind === "baseline"
            ? "below the published baseline"
            : "better than the first circuit"
      }
    />
  )
}
