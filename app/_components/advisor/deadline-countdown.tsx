"use client"

import { formatRemaining } from "@/lib/countdown"
import { cn } from "@/lib/utils"

import { useCountdown } from "@/hooks/use-countdown"

// Absolute lock time in the user's zone (no explicit timeZone). Hydration-safe
// because it is only formatted post-mount, once `now` is known.
const lockFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
})

/**
 * Live countdown to the team lock. Mount-gated (useCountdown): server render and
 * the first client render show a stable "Locks at —" placeholder, so there is no
 * hydration mismatch from a wall-clock read. After mount it ticks once a second,
 * freezes at the lock, and turns the time text accent-f1 inside the final 5 min.
 *
 * Accessibility: the per-second text is aria-hidden (it would spam a screen
 * reader); a separate polite live region announces only at coarse milestones.
 */
export function DeadlineCountdown({ lockAtMs }: { lockAtMs: number }) {
  const { now, announcement } = useCountdown(lockAtMs)

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
      <span className="text-muted-foreground"> · {lockFmt.format(lockAtMs)}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  )
}
