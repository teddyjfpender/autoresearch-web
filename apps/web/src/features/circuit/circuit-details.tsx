import { CopyCommand } from "@autoresearch/ui/components/copy-command"
import { cn } from "@autoresearch/ui/lib/cn"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import type { CircuitChallenge } from "@/data/circuit/schema"
import { formatToffoli } from "@/lib/circuit"
import { formatDate } from "@/lib/dates"

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

/**
 * Everything a participant needs besides the leaderboard. Every value comes from the challenge
 * repository's contract, registry and ledger, or its authored site content.
 */
export function CircuitDetails({ challenge }: { challenge: CircuitChallenge }) {
  const { benchmark, content, gates, targets, architectures, circuits } = challenge
  const done = gates.filter((gate) => gate.status === "done").length
  const { screen, full } = benchmark.validation
  const fill = (command: string) => command.replaceAll("{track}", challenge.trackId)
  const facts = [
    { label: "Track", value: challenge.trackId },
    { label: "Spec", value: challenge.board.spec },
    { label: "Epoch", value: benchmark.contractEpoch },
    { label: "Screen", value: `${screen.engine} · ${formatNumber(screen.samples)} lanes` },
    { label: "Full run", value: `${full.engine} · ${formatNumber(full.samples)} lanes` },
    { label: "Ledger at", value: challenge.repositoryCommit.slice(0, 8) },
  ]

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-label">{fact.label}</dt>
            <dd className="mt-1 font-mono text-sm break-words">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <Block title="The task" aside={challenge.headline}>
        <p className="text-sm text-fg-muted">{content.summary}</p>
        <p className="mt-3 text-sm text-fg-muted">{benchmark.standard.summary}</p>
      </Block>

      <Block title="Two levels of search" aside="Architecture first">
        <ol className="grid gap-4 sm:grid-cols-2">
          {content.levels.map((level, index) => (
            <li key={level.id}>
              <p className="text-sm">
                <span className="font-mono text-xs text-fg-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                {level.name}
              </p>
              <p className="mt-1 text-sm text-fg-muted">{level.description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-fg-muted">
          {String(architectures.length)} architectures are registered. A submission declares one; a
          new one is reviewed before it is recorded.
        </p>
      </Block>

      <Block title="Scoring" aside="Lower is better">
        <p className="font-mono text-sm">score = {benchmark.metric.formula}</p>
        <ul className="mt-3 space-y-2">
          {benchmark.metric.components.map((component) => (
            <li
              key={component.id}
              className="grid gap-1 text-sm sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
            >
              <span>{component.name}</span>
              <span className="text-fg-muted">{component.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fg-muted">
          {benchmark.acceptance.rule} The margin is{" "}
          {formatNumber(benchmark.acceptance.minImprovementBips / 100, 1)}%.
        </p>
      </Block>

      {targets.length === 0 ? null : (
        <Block title="Published point" aside="Context, not a ledger row">
          <ul className="space-y-3">
            {targets.map((target) => (
              <li key={target.id} className="text-sm">
                <p>
                  {target.label}:{" "}
                  <span className="font-mono tabular">
                    {formatToffoli(target.toffoliPublished)} Toffolis ×{" "}
                    {formatNumber(target.qubitsPublished)} qubits
                  </span>
                </p>
                <p className="mt-1 text-fg-faint">{target.citation}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-fg-muted">{challenge.targetConventions}</p>
        </Block>
      )}

      <Block title="Judging" aside={`${String(done)} of ${String(gates.length)} activation gates`}>
        <p className="text-sm text-fg-muted">
          The judge is the repository&apos;s CI. A submission&apos;s builder runs in a sandbox; the
          evaluator comes from the main branch and samples lanes from a seed the submitter cannot
          know. A valid circuit that earns a standing is merged and recorded by a bot.
        </p>
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" />
            Activation gates
          </summary>
          <ul className="mt-3 space-y-2">
            {gates.map((gate) => (
              <li
                key={gate.name}
                className="grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:gap-4"
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
        </details>
      </Block>

      <Block title="Rules">
        <ul className="space-y-2">
          {content.rules.map((rule) => (
            <li key={rule} className="text-sm text-fg-muted">
              {rule}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Participate" aside={`Edit ${benchmark.editablePaths.join(", ")} only`}>
        <ol className="space-y-3">
          {content.participate.map((step) => (
            <li key={step.title}>
              <p className="text-sm">{step.title}</p>
              {step.command === undefined ? (
                <p className="mt-1 text-sm text-fg-muted">{step.body}</p>
              ) : (
                <CopyCommand command={fill(step.command)} className="mt-1.5" />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            { label: "Task for agents", href: content.links.task },
            { label: "Repository", href: content.links.repo },
            { label: "Discussions", href: content.links.discussions },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-fg-muted hover:text-fg"
            >
              {link.label}
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          ))}
        </p>
        <p className="mt-4 text-label">
          {formatNumber(circuits.length)} circuits in the ledger · read{" "}
          {formatDate(challenge.repositoryDate)}
        </p>
      </Block>
    </div>
  )
}
