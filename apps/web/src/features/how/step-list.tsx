"use client"

import { cn } from "@autoresearch/ui/lib/cn"
import { motion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"

import type { Step } from "@/data/schema"

/** Numbered steps with a progress rail that fills as you scroll through them. */
export function StepList({ steps, className }: { steps: readonly Step[]; className?: string }) {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] })
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <ol ref={ref} className={cn("relative space-y-10 pl-10 sm:pl-14", className)}>
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-line sm:left-[1.1875rem]"
      />
      <motion.span
        aria-hidden
        className="absolute top-2 bottom-2 left-[0.6875rem] w-px origin-top bg-fg-faint sm:left-[1.1875rem]"
        style={{ scaleY }}
      />
      {steps.map((step, index) => (
        <motion.li
          key={step.title}
          className="relative border-b border-line pt-2 pb-10 last:border-0"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.span
            aria-hidden
            className="absolute top-1 -left-10 flex size-6 items-center justify-center rounded-full border border-line-strong bg-bg font-mono text-[0.625rem] text-fg-muted sm:-left-14 sm:size-10 sm:text-xs"
            initial={{ scale: 0.6 }}
            whileInView={{ scale: 1, color: "var(--ar-fg)" }}
            viewport={{ amount: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {String(index + 1).padStart(2, "0")}
          </motion.span>
          <h3 className="text-2xl font-normal tracking-tight sm:text-3xl">{step.title}</h3>
          <p className="mt-3 max-w-xl text-fg-muted">{step.body}</p>
        </motion.li>
      ))}
    </ol>
  )
}
