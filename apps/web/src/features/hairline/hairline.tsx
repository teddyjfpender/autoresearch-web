"use client"

import { cn } from "@autoresearch/ui/lib/cn"
import { useEffect, useRef, useState } from "react"

import { VIEW, type FigureMount } from "./engine"

/**
 * One line figure in a framed stage, with its caption underneath. The figure draws into an svg
 * after hydration, so the server renders the empty frame at its final size and nothing shifts.
 * `data` must be stable between renders (a module constant or memoised value): a new value
 * remounts the figure.
 */
export function Hairline<Data>({
  mount,
  data,
  label,
  figure,
  className,
}: {
  mount: FigureMount<Data>
  data: Data
  /** The accessible description of the drawing. */
  label: string
  /** The figure's number in its series, shown beside the caption. */
  figure: string
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [caption, setCaption] = useState("")

  useEffect(() => {
    if (stageRef.current === null || svgRef.current === null) return
    const target = svgRef.current
    const destroy = mount({ stage: stageRef.current, svg: target, read: setCaption }, data)
    return () => {
      destroy()
      target.replaceChildren()
    }
  }, [mount, data])

  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-line", className)}>
      <div ref={stageRef} data-hairline role="img" aria-label={label}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${String(VIEW.width)} ${String(VIEW.height)}`}
          aria-hidden
        />
      </div>
      <figcaption className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 font-mono text-[11px] text-fg-faint">
        <span>{figure}</span>
        <span className="truncate text-fg-muted" aria-live="off">
          {caption}
        </span>
      </figcaption>
    </figure>
  )
}
