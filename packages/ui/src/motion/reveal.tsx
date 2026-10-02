"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

export interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  /** Animate once when 15% of the element enters the viewport. */
  once?: boolean
}

/** Fade + rise + de-blur into place as the element scrolls into view. */
export function Reveal({ children, delay = 0, y = 14, className, once = true }: RevealProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce === true ? false : { opacity: 0, y, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.15 }}
      transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
