"use client"

import { motion } from "motion/react"

/**
 * Proving memory against the device, with the judge's reserve shaded at the right edge.
 * Animates its fill once when scrolled into view.
 */
export function MemoryBar({
  peakBytes,
  deviceBytes,
  reserveBytes,
  label,
}: {
  peakBytes: number
  deviceBytes: number
  reserveBytes: number
  label: string
}) {
  const fill = Math.min(1, peakBytes / deviceBytes)
  const reserve = reserveBytes / deviceBytes
  const tight = peakBytes > deviceBytes - reserveBytes * 6
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface"
        role="meter"
        aria-label="Whole-device peak memory"
        aria-valuemin={0}
        aria-valuemax={deviceBytes}
        aria-valuenow={peakBytes}
        aria-valuetext={label}
      >
        <motion.span
          className={
            tight
              ? "absolute inset-y-0 left-0 rounded-full bg-heat"
              : "absolute inset-y-0 left-0 rounded-full bg-fg-muted"
          }
          initial={{ width: 0 }}
          whileInView={{ width: `${String(fill * 100)}%` }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--ar-line-strong)_0_2px,transparent_2px_4px)]"
          style={{ width: `${String(reserve * 100)}%` }}
        />
      </div>
      <span className="w-28 text-right font-mono text-xs text-fg-muted tabular">{label}</span>
    </div>
  )
}
