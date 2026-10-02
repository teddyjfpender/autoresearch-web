"use client"

import { Moon, Sun } from "lucide-react"
import { motion } from "motion/react"

import { useTheme } from "../hooks/use-theme"
import { cn } from "../lib/cn"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative inline-flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full text-fg-muted transition-colors hover:bg-surface hover:text-fg",
        className,
      )}
    >
      <motion.span
        key={theme}
        initial={{ y: 18, opacity: 0, rotate: -90 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className="inline-flex"
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </motion.span>
    </button>
  )
}
