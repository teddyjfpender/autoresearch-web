"use client"

import { motion, useMotionValue, useSpring } from "motion/react"
import type { PointerEvent, ReactNode } from "react"

import { useFinePointer } from "../hooks/use-pointer"

export interface MagneticProps {
  children: ReactNode
  /** Fraction of the pointer offset the element follows. */
  strength?: number
  className?: string
}

/** Pulls its child toward the cursor while hovered, then springs back. */
export function Magnetic({ children, strength = 0.12, className }: MagneticProps) {
  const fine = useFinePointer()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 })

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!fine) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left - rect.width / 2) * strength)
    y.set((event.clientY - rect.top - rect.height / 2) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className={className ?? "inline-block"}
      style={{ x: springX, y: springY }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  )
}
