"use client"

import { useEffect, useRef, useState } from "react"

import { announce, type Milestone, milestoneFor } from "@/lib/countdown"
import { currentTimeMs } from "@/lib/dev-now"

/**
 * Mount-gated ticking clock for the deadline countdown. Returns `now` (null
 * until mount, so server + first client render agree) and a coarse milestone
 * `announcement` for a polite live region. Ticks once a second and freezes at
 * the lock (the interval is cleared).
 */
export function useCountdown(lockAtMs: number): { now: number | null; announcement: string } {
  const [now, setNow] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const lastMilestone = useRef<Milestone | null>(null)

  useEffect(() => {
    const tick = () => {
      const t = currentTimeMs()
      setNow(t)
      const milestone = milestoneFor(lockAtMs - t)
      if (milestone !== lastMilestone.current) {
        lastMilestone.current = milestone
        setAnnouncement(announce(milestone, lockAtMs - t))
      }
      return t
    }
    const first = tick()
    if (first >= lockAtMs) return // already locked — no interval to clean up.

    const id = setInterval(() => {
      const t = tick()
      if (t >= lockAtMs) clearInterval(id) // freeze at the lock.
    }, 1000)
    return () => clearInterval(id)
  }, [lockAtMs])

  return { now, announcement }
}
