"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ElementType } from "react"

import { cn } from "../lib/cn"

export interface SplitTextProps {
  text: string
  as?: ElementType
  className?: string
  wordClassName?: string
  delay?: number
  stagger?: number
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean
}

/**
 * Splits text into words and slides each up from behind a mask. Screen readers get the
 * plain string via aria-label; the animated spans are hidden from them.
 */
export function SplitText({
  text,
  as: Tag = "span",
  className,
  wordClassName,
  delay = 0,
  stagger = 0.04,
  inView = false,
}: SplitTextProps) {
  const reduce = useReducedMotion() === true
  const words = text.split(" ")
  const hidden = { y: "105%", opacity: 0 }
  const shown = { y: "0%", opacity: 1 }

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={`${word}-${String(index)}`}
          aria-hidden
          className="inline-block overflow-hidden pb-[0.12em] align-bottom"
        >
          <motion.span
            className={cn("inline-block will-change-transform", wordClassName)}
            initial={reduce ? false : hidden}
            {...(inView
              ? { whileInView: shown, viewport: { once: true, amount: 0.6 } }
              : { animate: shown })}
            transition={{ duration: 1.2, delay: delay + index * stagger, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  )
}
