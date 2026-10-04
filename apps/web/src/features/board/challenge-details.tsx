import { CopyCommand } from "@autoresearch/ui/components/copy-command"
import { Formula } from "@autoresearch/ui/components/formula"
import { cn } from "@autoresearch/ui/lib/cn"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import type { Challenge } from "@/data/schema"
import { formatDate } from "@/lib/dates"
import { formatGB, formatSeconds } from "@/lib/format"
import { guardLabel } from "@/lib/guards"

function Block({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="grid gap-4 border-t border-line pt-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <h3 className="text-lg tracking-tight">{title}</h3>
        {aside === undefined ? null : <p className="mt-1 text-label">{aside}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Collapsible({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group mt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" />
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

/**
 * Everything a participant needs besides the leaderboard, condensed into one reference view.
 * Every value comes from the imported contract, fixture and reports or the authored content.
 */
export function ChallengeDetails({ challenge }: { challenge: Challenge }) {
  const { contract, cases, families, stages, tracks, tiers, gates } = challenge
  const done = gates.filter((gate) => gate.status === "done").length
  const familyName = new Map(families.map((family) => [family.id, family.name]))
  const stageName = new Map(stages.map((stage) => [stage.id, stage.name]))
  const familyShare = formatNumber(100 / families.length, 0)

  const { deviceBytes } = contract.hardware
  const { interactionPowBits } = contract.security
  const facts = [
    { label: "Hardware", value: `1× ${contract.hardware.gpu}` },
    deviceBytes === undefined
      ? { label: "Proof suite", value: contract.security.preprocessedVariant }
      : { label: "Device memory", value: formatGB(deviceBytes, 2) },
    { label: "FRI queries", value: String(contract.security.friQueries) },
    {
      label: "PoW bits",
      value:
        interactionPowBits === undefined
          ? String(contract.security.queryPowBits)
          : `${String(contract.security.queryPowBits)} / ${String(interactionPowBits)}`,
    },
    { label: "Pinned stwo-zig", value: contract.sourceCommit.slice(0, 8) },
    { label: "Epoch", value: contract.draft ? `${contract.epoch} (draft)` : contract.epoch },
  ]

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-label">{fact.label}</dt>
            <dd className="mt-1 font-mono text-sm">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <Block title="What gets proved" aside={`${String(stages.length)} proof stages`}>
        <ol className="grid gap-4 sm:grid-cols-3">
          {stages.map((stage, index) => (
            <li key={stage.id}>
              <p className="text-sm">
                <span className="font-mono text-xs text-fg-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                {stage.name}
              </p>
              <p className="mt-1 text-sm text-fg-muted">{stage.summary}</p>
            </li>
          ))}
        </ol>
      </Block>

      <Block
        title="Workload"
        aside={`${String(cases.length)} cases · ${String(families.length)} families at ${familyShare}% weight each`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line">
                {["Case", "Family", "Stages", "Proof time", "Peak memory"].map((header, index) => (
                  <th
                    key={header}
                    scope="col"
                    className={cn(
                      "h-9 pr-4 text-label font-normal",
                      index >= 3 ? "text-right" : "text-left",
                    )}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((testCase) => (
                <tr key={testCase.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4">{testCase.title}</td>
                  <td className="pr-4 text-fg-muted">{familyName.get(testCase.family)}</td>
                  <td className="pr-4 text-fg-muted">
                    {testCase.stages.map((id) => stageName.get(id)).join(" → ")}
                  </td>
                  <td className="pr-4 text-right font-mono text-xs tabular">
                    {testCase.baseline.proofTimeS === null
                      ? "Pending"
                      : formatSeconds(testCase.baseline.proofTimeS)}
                  </td>
                  <td className="text-right font-mono text-xs text-fg-muted tabular">
                    {testCase.baseline.peakBytes === null
                      ? "—"
                      : formatGB(testCase.baseline.peakBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-label">
          {contract.timeScope} Unranked direct observations on {contract.hardware.gpu}; latest
          recorded {formatDate(contract.baselineMeasuredAt)}.
        </p>
      </Block>

      <Block title="Scoring" aside="Correctness gates every track">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    {track.name}
                  </th>
                  <td className="py-3 pr-6 whitespace-nowrap">
                    <Formula>{track.formula}</Formula>
                  </td>
                  <td className="py-3 text-fg-muted">
                    {track.guards.map((guard) => (
                      <Formula key={guardLabel(guard)} className="mr-4 inline-block">
                        {guardLabel(guard)}
                      </Formula>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          <Formula>R_T</Formula> and <Formula>R_M</Formula> are family-weighted geometric means of
          paired per-case ratios. A new leader must beat the current one by{" "}
          {formatNumber(contract.minImprovement * 100)}% across {String(contract.pairedRounds)}+
          ABBA rounds ({formatNumber(contract.bootstrapResamples)}-sample bootstrap).
        </p>
      </Block>

      <Block title="Judging" aside={`${String(done)} of ${String(gates.length)} activation gates`}>
        <p className="text-sm">
          {tiers.map((tier, index) => (
            <span key={tier.id}>
              {index > 0 ? <span className="text-fg-faint"> → </span> : null}
              {tier.name}
              <span className="text-fg-faint"> ({tier.gpu ? "H200" : "CPU"})</span>
            </span>
          ))}
        </p>
        <Collapsible summary="Activation gates">
          <ul className="space-y-2">
            {gates.map((gate) => (
              <li
                key={gate.name}
                className="grid gap-1 text-sm sm:grid-cols-[10rem_6rem_minmax(0,1fr)] sm:gap-4"
              >
                <span>{gate.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    gate.status === "done"
                      ? "text-fg-muted"
                      : gate.status === "partial"
                        ? "text-heat"
                        : "text-fg-faint",
                  )}
                >
                  {gate.status}
                </span>
                <span className="text-fg-faint">{gate.evidence}</span>
              </li>
            ))}
          </ul>
        </Collapsible>
      </Block>

      <Block
        title="Participate"
        aside={`Edit ${String(contract.editablePaths.length)} CUDA paths only`}
      >
        <ol className="space-y-3">
          {challenge.participate.map((step) => (
            <li key={step.title}>
              <p className="text-sm">{step.title}</p>
              {step.command === undefined ? (
                <p className="mt-1 text-sm text-fg-muted">{step.body}</p>
              ) : (
                <CopyCommand command={step.command} className="mt-1.5" />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap gap-2">
          {contract.editablePaths.map((path) => (
            <span
              key={path}
              className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-fg-muted"
            >
              {path}
            </span>
          ))}
        </p>
        <Collapsible summary={`House rules (${String(challenge.rules.length)})`}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            {challenge.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Collapsible>
      </Block>
    </div>
  )
}
