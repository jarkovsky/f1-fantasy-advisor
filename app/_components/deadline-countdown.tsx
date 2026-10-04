"use client"

import { useEffect, useRef, useState } from "react"

import { currentTimeMs } from "@/lib/dev-now"
import { cn } from "@/lib/utils"

/**
 * Live countdown to the team lock. Mount-gated: server render and the first
 * client render show a stable "Locks at —" placeholder, so there is no
 * hydration mismatch from a wall-clock read. After mount it ticks once a
 * second, FREEZES at the lock (the interval is cleared), and turns the time
 * text accent-f1 inside the final 5 minutes.
 *
 * Accessibility: the per-second text is aria-hidden (it would spam a screen
 * reader); a separate polite live region announces only at coarse milestones
 * (mount, 1h, 15m, 5m, 1m, locked).
 */
type DeadlineCountdownProps = { lockAtMs: number }

type Milestone = "mount" | "1h" | "15m" | "5m" | "1m" | "locked"

function milestoneFor(remainingMs: number): Milestone {
  if (remainingMs <= 0) return "locked"
  const min = remainingMs / 60_000
  if (min <= 1) return "1m"
  if (min <= 5) return "5m"
  if (min <= 15) return "15m"
  if (min <= 60) return "1h"
  return "mount"
}

function formatRemaining(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (remainingMs >= 3_600_000) {
    // ≥ 1h: coarse "2d 14h 33m" / "14h 33m".
    return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`
  }
  // < 1h: "14m 12s".
  return `${minutes}m ${seconds}s`
}

function announce(milestone: Milestone, lockAtMs: number): string {
  if (milestone === "locked") return "Team locked."
  return `Lock in ${formatRemaining(lockAtMs - currentTimeMs())}.`
}

export function DeadlineCountdown({ lockAtMs }: DeadlineCountdownProps) {
  const [now, setNow] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const lastMilestone = useRef<Milestone | null>(null)

  useEffect(() => {
    // Post-mount: read the clock and tick every second until the lock.
    const tick = () => {
      const t = currentTimeMs()
      setNow(t)
      const milestone = milestoneFor(lockAtMs - t)
      if (milestone !== lastMilestone.current) {
        lastMilestone.current = milestone
        setMessage(announce(milestone, lockAtMs))
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

  // Absolute local time with zone — Intl only runs post-mount (now !== null),
  // so it is hydration-safe (no explicit timeZone: render in the user's zone).
  const absolute =
    now === null
      ? null
      : new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(lockAtMs)

  if (now === null) {
    return <span className="font-mono text-sm text-muted-foreground">Locks at —</span>
  }

  const remaining = lockAtMs - now
  const locked = remaining <= 0
  const urgent = !locked && remaining < 5 * 60_000

  return (
    <span className="font-mono text-sm">
      <span
        aria-hidden="true"
        className={cn(
          "font-medium",
          locked ? "text-muted-foreground" : urgent ? "text-accent-f1" : "text-foreground"
        )}
      >
        {locked ? "Locked" : `Locks in ${formatRemaining(remaining)}`}
      </span>
      {absolute && <span className="text-muted-foreground"> · {absolute}</span>}
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </span>
  )
}
