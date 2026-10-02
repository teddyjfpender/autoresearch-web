import { Fragment, type ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * Lightweight math notation for UI copy. Authors write plain ASCII such as `1 / R_T` or
 * `R_T ≤ 1.25`; these helpers render `X_Y` as X with a true subscript Y, so data files and
 * code keep a simple, greppable form while the UI reads like typeset math.
 */

type Segment = { kind: "text"; value: string } | { kind: "sub"; base: string; sub: string }

const SUBSCRIPT = /([A-Za-z])_([A-Za-z0-9]+)/g

export function parseFormula(text: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(SUBSCRIPT)) {
    const [whole, base = "", sub = ""] = match
    const index = match.index
    if (index > last) segments.push({ kind: "text", value: text.slice(last, index) })
    segments.push({ kind: "sub", base, sub })
    last = index + whole.length
  }
  if (last < text.length) segments.push({ kind: "text", value: text.slice(last) })
  return segments
}

/** Plain-text reading of a formula for aria labels and titles: `R_T` → "R sub T". */
export function formulaText(text: string): string {
  return text.replaceAll(SUBSCRIPT, "$1 sub $2")
}

export interface FormulaProps {
  children: string
  className?: string
}

/** Inline formula for HTML: subscripts sit low without disturbing the line height. */
export function Formula({ children, className }: FormulaProps): ReactNode {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {parseFormula(children).map((segment, index) =>
        segment.kind === "text" ? (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- segments are positional and never reorder
          <Fragment key={index}>{segment.value}</Fragment>
        ) : (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- segments are positional and never reorder
          <span key={index}>
            {segment.base}
            <sub className="relative -bottom-[0.1em] align-baseline text-[0.7em] leading-none">
              {segment.sub}
            </sub>
          </span>
        ),
      )}
    </span>
  )
}

/**
 * The same notation for SVG `<text>`. Uses `dy` shifts rather than `baseline-shift`, which
 * Safari ignores, and restores the baseline after each subscript.
 */
export function SvgFormula({ children }: { children: string }): ReactNode {
  return (
    <>
      {parseFormula(children).map((segment, index) =>
        segment.kind === "text" ? (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- segments are positional and never reorder
          <tspan key={index}>{segment.value}</tspan>
        ) : (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- segments are positional and never reorder
          <Fragment key={index}>
            <tspan>{segment.base}</tspan>
            <tspan dy="0.3em" fontSize="0.72em">
              {segment.sub}
            </tspan>
            {/* Zero-width reset back to the main baseline. */}
            <tspan dy="-0.3em">{"​"}</tspan>
          </Fragment>
        ),
      )}
    </>
  )
}
