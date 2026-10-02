"use client"

import { useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef } from "react"

import { cn } from "../lib/cn"

const GLYPHS = "01░▒▓<>/\\{}[]#$%&*+=?ABCDEF"

export interface ScrambleTextProps {
  text: string
  className?: string
  /** Re-run the scramble on hover. */
  onHover?: boolean
  durationMs?: number
}

/** Decodes text from random glyphs, left to right, like a terminal resolving a value. */
export function ScrambleText({
  text,
  className,
  onHover = true,
  durationMs = 700,
}: ScrambleTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const frameRef = useRef(0)
  const reduce = useReducedMotion() === true

  const run = useCallback(() => {
    const node = ref.current
    if (!node || reduce) return
    cancelAnimationFrame(frameRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const settled = Math.floor(progress * text.length)
      let out = ""
      for (let index = 0; index < text.length; index += 1) {
        const char = text.charAt(index)
        out +=
          index < settled || char === " "
            ? char
            : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length))
      }
      node.textContent = out
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [text, durationMs, reduce])

  useEffect(() => {
    run()
    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [run])

  return (
    <span
      ref={ref}
      className={cn("tabular", className)}
      aria-label={text}
      {...(onHover ? { onPointerEnter: run } : {})}
    >
      {text}
    </span>
  )
}
