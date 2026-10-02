"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Copy text to the clipboard and expose a transient `copied` flag for feedback. */
export function useCopy(resetAfterMs = 1600): {
  copied: boolean
  copy: (text: string) => Promise<void>
} {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setCopied(false)
        }, resetAfterMs)
      } catch {
        setCopied(false)
      }
    },
    [resetAfterMs],
  )

  return { copied, copy }
}
