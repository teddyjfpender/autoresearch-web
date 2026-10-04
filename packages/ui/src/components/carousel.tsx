"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "../lib/cn"

export interface CarouselSlide {
  id: string
  content: ReactNode
}

export interface CarouselProps {
  slides: readonly CarouselSlide[]
  /** Accessible name for the region, e.g. "Challenges". */
  label: string
  /** Slide width; the next slide peeks in so the track reads as browsable. */
  slideClassName?: string
  className?: string
}

/**
 * Horizontal, scroll-snapped carousel. Native scrolling (touch, trackpad, keyboard) drives it;
 * the controls and counter only call `scrollTo`, so nothing fights the browser.
 */
/** Scroll offset that puts `child` at the track's start edge, inside its padding. */
const slideLeft = (track: HTMLElement, child: Element) =>
  (child as HTMLElement).offsetLeft -
  track.offsetLeft -
  Number.parseFloat(getComputedStyle(track).paddingLeft)

export function Carousel({
  slides,
  label,
  slideClassName = "basis-full md:basis-[85%] lg:basis-[78%]",
  className,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const measure = useCallback(() => {
    const node = trackRef.current
    if (!node) return
    // At the end of the track the last slide can't snap to the start edge; count it as active.
    if (node.scrollLeft >= node.scrollWidth - node.clientWidth - 2) {
      setActive(node.children.length - 1)
      return
    }
    const left = node.getBoundingClientRect().left
    let nearest = 0
    let distance = Infinity
    for (const [index, child] of [...node.children].entries()) {
      const d = Math.abs(child.getBoundingClientRect().left - left)
      if (d < distance) {
        distance = d
        nearest = index
      }
    }
    setActive(nearest)
  }, [])

  useEffect(() => {
    const node = trackRef.current
    if (!node) return
    // Horizontal swipes scroll the track natively, so momentum and snapping stay smooth. The
    // gesture's small vertical deltas must not reach a smooth-scroll library listening on
    // window, so a gesture that starts horizontal is kept from bubbling until it goes idle;
    // the browser latches the rest of the gesture to the track.
    let horizontal = false
    let idle: number | undefined
    const onWheel = (event: WheelEvent) => {
      if (!horizontal && Math.abs(event.deltaX) > Math.abs(event.deltaY)) horizontal = true
      if (!horizontal) return
      event.stopPropagation()
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        horizontal = false
        snap()
      }, 180)
    }
    // Snap in script, not CSS: once momentum ends, ease onto the nearest slide. CSS mandatory
    // snapping re-targets mid-gesture on trackpads, which reads as jumping.
    let settle: number | undefined
    const snap = () => {
      if (horizontal) return
      const atEnd = node.scrollLeft >= node.scrollWidth - node.clientWidth - 2
      if (atEnd) return
      const lefts = [...node.children].map((child) => slideLeft(node, child))
      const nearest = lefts.reduce(
        (best, left) =>
          Math.abs(left - node.scrollLeft) < Math.abs(best - node.scrollLeft) ? left : best,
        0,
      )
      if (Math.abs(nearest - node.scrollLeft) > 2)
        node.scrollTo({ left: nearest, behavior: "smooth" })
    }
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
      window.clearTimeout(settle)
      settle = window.setTimeout(snap, 160)
    }
    node.addEventListener("scroll", onScroll, { passive: true })
    node.addEventListener("wheel", onWheel, { passive: true })
    return () => {
      window.clearTimeout(idle)
      window.clearTimeout(settle)
      cancelAnimationFrame(frame)
      node.removeEventListener("scroll", onScroll)
      node.removeEventListener("wheel", onWheel)
    }
  }, [measure])

  const go = (index: number) => {
    const node = trackRef.current
    const target = node?.children[Math.max(0, Math.min(slides.length - 1, index))]
    if (!node || !(target instanceof HTMLElement)) return
    node.scrollTo({ left: slideLeft(node, target), behavior: "smooth" })
  }

  const control =
    "inline-flex size-10 items-center justify-center rounded-full border border-line-strong text-fg transition-colors duration-300 hover:bg-fg hover:text-bg disabled:pointer-events-none disabled:opacity-30"

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("flex flex-col gap-6", className)}
    >
      <div
        ref={trackRef}
        className="-mx-4 flex scroll-px-4 [scrollbar-width:none] gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${String(index + 1)} of ${String(slides.length)}`}
            className={cn("shrink-0", slideClassName)}
          >
            {slide.content}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" aria-hidden>
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              className={cn(
                "h-1 rounded-full transition-[width,background-color] duration-500 ease-out-expo",
                index === active ? "w-8 bg-accent" : "w-3 bg-line-strong",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-fg-faint tabular" aria-live="polite">
            {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            className={control}
            onClick={() => {
              go(active - 1)
            }}
            disabled={active === 0}
            aria-label="Previous"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            className={control}
            onClick={() => {
              go(active + 1)
            }}
            disabled={active === slides.length - 1}
            aria-label="Next"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
