"use client"

import { animate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

import { cn } from "../lib/cn"
import { formatNumber } from "../lib/format"

export interface NumberTickerProps {
  value: number
  from?: number
  fractionDigits?: number
  prefix?: string
  suffix?: string
  duration?: number
  delay?: number
  className?: string
}

/**
 * Counts up to `value` once in view. Writes straight to the DOM node, so it never re-renders
 * React per frame. Server output is the final value, so no-JS and crawlers see real numbers.
 */
export function NumberTicker({
  value,
  from = 0,
  fractionDigits = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  delay = 0,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const reduce = useReducedMotion() === true
  const render = (n: number) => `${prefix}${formatNumber(n, fractionDigits)}${suffix}`

  useEffect(() => {
    const node = ref.current
    if (!node || !inView || reduce) return
    const controls = animate(from, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = `${prefix}${formatNumber(latest, fractionDigits)}${suffix}`
      },
    })
    return () => {
      controls.stop()
    }
  }, [inView, reduce, from, value, duration, delay, prefix, suffix, fractionDigits])

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {render(value)}
    </span>
  )
}
