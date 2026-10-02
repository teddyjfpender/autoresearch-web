"use client"

import { Check, Copy } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { useCopy } from "../hooks/use-copy"
import { cn } from "../lib/cn"

export interface CopyCommandProps {
  command: string
  prompt?: string
  className?: string
}

/** A single shell command with a copy button and an animated confirmation. */
export function CopyCommand({ command, prompt = "$", className }: CopyCommandProps) {
  const { copied, copy } = useCopy()
  return (
    <div
      className={cn(
        "group/cmd flex items-center gap-3 rounded-xl border border-line bg-bg py-1.5 pr-1.5 pl-4 font-mono text-sm transition-colors duration-300 hover:border-line-strong",
        className,
      )}
    >
      <span className="text-fg-faint select-none" aria-hidden>
        {prompt}
      </span>
      <code className="min-w-0 flex-1 truncate text-fg">{command}</code>
      <button
        type="button"
        onClick={() => void copy(command)}
        aria-label={copied ? "Copied" : "Copy command"}
        className="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "check" : "copy"}
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            className={cn("inline-flex", copied && "text-fg")}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}
