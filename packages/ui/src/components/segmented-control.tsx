"use client"

import { LayoutGroup, motion } from "motion/react"
import { ToggleGroup } from "radix-ui"
import { useId } from "react"

import { cn } from "../lib/cn"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  "aria-label": string
  size?: "sm" | "md"
  className?: string
}

/**
 * Single-select pill switcher with a shared-layout highlight that glides between options.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const layoutId = useId()
  return (
    <LayoutGroup id={layoutId}>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(next) => {
          const match = options.find((option) => option.value === next)
          if (match) onValueChange(match.value)
        }}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border border-line p-0.5",
          className,
        )}
        {...aria}
      >
        {options.map((option) => {
          const active = option.value === value
          return (
            <ToggleGroup.Item
              key={option.value}
              value={option.value}
              className={cn(
                "relative cursor-pointer rounded-full transition-colors duration-300",
                size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-4 text-sm",
                active ? "text-fg" : "text-fg-faint hover:text-fg-muted",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="segmented-thumb"
                  className="absolute inset-0 rounded-full bg-surface-strong"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </ToggleGroup.Item>
          )
        })}
      </ToggleGroup.Root>
    </LayoutGroup>
  )
}
