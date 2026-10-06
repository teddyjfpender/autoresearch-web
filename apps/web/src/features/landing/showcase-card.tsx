import { NumberTicker } from "@autoresearch/ui/motion/number-ticker"
import { Spotlight } from "@autoresearch/ui/motion/spotlight"
import { ArrowUpRight } from "lucide-react"
import type { Route } from "next"
import type { ReactNode } from "react"

import { SectionLink } from "../site/section-link"

/**
 * One challenge on the landing carousel: its status, one number, its name and one sentence.
 * Everything else about a challenge lives on its own page.
 */
export function ShowcaseCard({
  href,
  status,
  name,
  headline,
  figure,
  label,
}: {
  href: Route
  status: ReactNode
  name: string
  /** What the challenge asks for, in one sentence. */
  headline: string
  /** The improvement so far as a percentage, or null while the baseline is unbeaten. */
  figure: number | null
  /** What the figure measures, in a few words. */
  label: string
}) {
  return (
    <Spotlight className="group/card h-full">
      <SectionLink href={href} className="flex h-full min-h-[21rem] flex-col p-6 sm:p-7">
        <div>{status}</div>
        <div className="mt-10">
          <p
            className={
              figure === null
                ? "text-[clamp(2.75rem,4.5vw,3.75rem)] leading-[0.9] font-light tracking-[-0.05em] text-fg-faint"
                : "text-[clamp(2.75rem,4.5vw,3.75rem)] leading-[0.9] font-light tracking-[-0.05em] text-accent tabular"
            }
          >
            {figure === null ? "Open" : <NumberTicker value={figure} suffix="%" />}
          </p>
          <p className="mt-3 text-sm text-fg-muted">{label}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-10">
          <div className="min-w-0">
            <h3 className="text-2xl font-normal tracking-[-0.04em]">{name}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{headline}</p>
          </div>
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-fg transition-[transform,background-color,color] duration-500 ease-out-expo group-hover/card:rotate-45 group-hover/card:bg-fg group-hover/card:text-bg"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </SectionLink>
    </Spotlight>
  )
}
