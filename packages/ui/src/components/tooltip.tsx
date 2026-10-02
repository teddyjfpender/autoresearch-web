"use client"

import { Tooltip as TooltipPrimitive } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "../lib/cn"

export function TooltipProvider({
  delayDuration = 120,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 max-w-xs rounded-lg border border-line-strong bg-surface-strong px-3 py-2 text-xs text-fg shadow-2xl",
            "origin-(--radix-tooltip-content-transform-origin) animate-pop-in",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
