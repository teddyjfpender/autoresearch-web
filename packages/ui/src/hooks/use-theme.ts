"use client"

import { useCallback, useSyncExternalStore } from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "ar-theme"
const listeners = new Set<() => void>()

function readTheme(): Theme {
  return document.documentElement.dataset["theme"] === "light" ? "light" : "dark"
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Theme lives on `<html data-theme>`; this hook reads and writes it. Pair it with
 * `themeInitScript` in the document head to avoid a flash on load.
 */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const)

  const setTheme = useCallback((next: Theme) => {
    const apply = () => {
      document.documentElement.dataset["theme"] = next
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Storage can be unavailable (private mode); the theme still applies for this visit.
      }
      for (const listener of listeners) listener()
    }
    if ("startViewTransition" in document) document.startViewTransition(apply)
    else apply()
  }, [])

  const toggle = useCallback(() => {
    setTheme(readTheme() === "dark" ? "light" : "dark")
  }, [setTheme])

  return { theme, setTheme, toggle }
}

/** Inline in `<head>` so the stored theme applies before first paint. */
export const themeInitScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
