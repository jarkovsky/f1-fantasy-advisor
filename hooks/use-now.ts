"use client"

import { useEffect, useState } from "react"

import { currentTimeMs } from "@/lib/dev-now"

/**
 * Mount-gated wall clock. Returns null on the server and the first client render
 * (so hydration matches), then the current time, re-read every `pollMs`.
 */
export function useNow(pollMs: number): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(currentTimeMs())
    update()
    const id = setInterval(update, pollMs)
    return () => clearInterval(id)
  }, [pollMs])
  return now
}
