"use client"

import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia("(hover: hover) and (pointer: fine)")
  query.addEventListener("change", onChange)
  return () => {
    query.removeEventListener("change", onChange)
  }
}

/** True on devices with a precise hovering pointer (mouse/trackpad). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    () => false,
  )
}
