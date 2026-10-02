"use client"

import { cn } from "@autoresearch/ui/lib/cn"
import { useEffect, useRef } from "react"

const SPACING = 22
const RADIUS = 1.1

function readColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * A quiet field of dots, like idle GPU lanes. Dots near the pointer lift gently, and a
 * single slow ripple crosses the field every few seconds. Monochrome, DPR-aware, paused
 * off-screen, static under reduced motion.
 */
export function WarpField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const pointer = { x: -9999, y: -9999, sx: -9999, sy: -9999 }
    let dot = ""
    let width = 0
    let height = 0
    let frame = 0
    let visible = true

    const refreshColors = () => {
      dot = readColor("--ar-fg")
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = dot
      // Pointer influence trails the cursor for a soft, unhurried feel.
      pointer.sx += (pointer.x - pointer.sx) * 0.08
      pointer.sy += (pointer.y - pointer.sy) * 0.08
      const t = time / 1000
      const rippleX = ((t % 7) / 7) * (width + 400) - 200

      for (let y = SPACING / 2; y < height; y += SPACING) {
        for (let x = SPACING / 2; x < width; x += SPACING) {
          const near = Math.max(0, 1 - Math.hypot(x - pointer.sx, y - pointer.sy) / 220)
          const ripple = Math.max(0, 1 - Math.abs(x - rippleX) / 120) * 0.35
          const lift = Math.max(near * near, ripple)
          context.globalAlpha = 0.09 + lift * 0.32
          context.beginPath()
          context.arc(x, y, RADIUS + lift * 0.9, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.globalAlpha = 1
    }

    const loop = (time: number) => {
      if (visible) draw(time)
      frame = requestAnimationFrame(loop)
    }

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
    }

    refreshColors()
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    intersection.observe(canvas)
    const themeObserver = new MutationObserver(refreshColors)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    window.addEventListener("pointermove", onPointer, { passive: true })

    if (reduce) draw(0)
    else frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersection.disconnect()
      themeObserver.disconnect()
      window.removeEventListener("pointermove", onPointer)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={cn("size-full", className)} />
}
