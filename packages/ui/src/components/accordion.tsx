"use client"

import { Plus } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export function Accordion(props: ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-line", className)}
      {...props}
    />
  )
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/acc flex flex-1 cursor-pointer items-center justify-between gap-6 py-6 text-left text-lg tracking-tight transition-colors hover:text-fg-muted sm:text-xl",
          className,
        )}
        {...props}
      >
        {children}
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-muted transition-[transform,background-color,border-color,color] duration-500 ease-out-expo group-hover/acc:border-line-strong group-data-[state=open]/acc:rotate-45 group-data-[state=open]/acc:text-fg">
          <Plus className="size-4" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("max-w-2xl pb-6 text-fg-muted", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
