"use client"

import Lenis from "lenis"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { registerLenis, SCROLL_OFFSET, scrollToHash } from "./scroll"

/**
 * Inertial scrolling (skipped under reduced motion), plus route-change scrolling: a new
 * route opens at the top, or exactly on its `#section` below the fixed header.
 */
export function SmoothScroll() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const lenis = new Lenis({ lerp: 0.11 })
    registerLenis(lenis)
    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(frame)
      registerLenis(null)
      lenis.destroy()
    }
  }, [])

  useEffect(() => {
    // A new route opens at the very top, or on its #section. The target can mount a few
    // frames after the pathname changes (e.g. leaving a not-found boundary), so retry for a
    // short window before falling back to the top.
    const MAX_FRAMES = 45
    /** Content above the target can keep streaming in; hold the target in place this long. */
    const PIN_MS = 1500
    let attempts = 0
    let frame = 0
    let pinnedUntil = 0
    let userMoved = false
    const stop = () => {
      userMoved = true
    }
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const
    for (const type of inputs) window.addEventListener(type, stop, { passive: true, once: true })

    const pin = (hash: string) => {
      if (userMoved || performance.now() > pinnedUntil) return
      const target = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (target && Math.abs(target.getBoundingClientRect().top - SCROLL_OFFSET) > 2) {
        scrollToHash(hash, { immediate: true })
      }
      frame = requestAnimationFrame(() => {
        pin(hash)
      })
    }
    const settle = () => {
      const { hash } = window.location
      if (hash === "") {
        scrollToHash("", { immediate: true })
        return
      }
      if (scrollToHash(hash, { immediate: true })) {
        pinnedUntil = performance.now() + PIN_MS
        frame = requestAnimationFrame(() => {
          pin(hash)
        })
        return
      }
      attempts += 1
      if (attempts < MAX_FRAMES) frame = requestAnimationFrame(settle)
      else scrollToHash("", { immediate: true })
    }
    frame = requestAnimationFrame(settle)
    return () => {
      cancelAnimationFrame(frame)
      for (const type of inputs) window.removeEventListener(type, stop)
    }
  }, [pathname])

  return null
}
