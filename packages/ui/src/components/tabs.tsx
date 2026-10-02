"use client"

import { motion } from "motion/react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { useId, type ComponentProps, type ReactNode } from "react"

import { cn } from "../lib/cn"

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  /** Optional count or hint shown after the label. */
  meta?: ReactNode
}

export interface TabsProps<T extends string> extends Omit<
  ComponentProps<typeof TabsPrimitive.Root>,
  "value" | "onValueChange" | "defaultValue"
> {
  value: T
  onValueChange: (value: T) => void
  items: readonly TabItem<T>[]
  "aria-label": string
}

/**
 * Underlined tab bar with a shared-layout indicator. Content is passed as children using
 * `TabsPanel`; inactive panels stay mounted (hidden) so in-page anchors keep their targets.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: TabsProps<T>) {
  const layoutId = useId()
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const match = items.find((item) => item.value === next)
        if (match) onValueChange(match.value)
      }}
      className={cn("w-full", className)}
      {...props}
    >
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className="relative flex gap-6 overflow-x-auto border-b border-line"
      >
        {items.map((item) => {
          const active = item.value === value
          return (
            <TabsPrimitive.Trigger
              key={item.value}
              value={item.value}
              className={cn(
                "relative -mb-px flex h-11 shrink-0 cursor-pointer items-center gap-2 text-sm transition-colors duration-300",
                active ? "text-fg" : "text-fg-faint hover:text-fg-muted",
              )}
            >
              {item.label}
              {item.meta === undefined ? null : (
                <span className="font-mono text-xs text-fg-faint tabular">{item.meta}</span>
              )}
              {active ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-x-0 bottom-0 h-px bg-fg"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
            </TabsPrimitive.Trigger>
          )
        })}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabsPanel({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      forceMount
      className={cn("pt-8 focus-visible:outline-none data-[state=inactive]:hidden", className)}
      {...props}
    />
  )
}
