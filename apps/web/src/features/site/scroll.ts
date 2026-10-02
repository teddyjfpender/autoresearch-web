"use client"

import type Lenis from "lenis"

/** Clearance for the fixed header. Keep in sync with `scroll-mt-24` on sections. */
export const SCROLL_OFFSET = 96

let instance: Lenis | null = null

export function registerLenis(lenis: Lenis | null): void {
  instance = lenis
}

/** Scroll to `#id` (or the top for an empty hash), accounting for the fixed header. */
export function scrollToHash(hash: string, { immediate = false } = {}): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""))
  const target = id === "" ? null : document.getElementById(id)
  if (id !== "" && !target) return false
  // Resolve to an absolute pixel position ourselves so CSS `scroll-margin` isn't applied twice.
  const top = target ? target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET : 0
  if (instance) {
    instance.scrollTo(Math.max(0, top), {
      immediate,
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    })
  } else {
    window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" })
  }
  return true
}
