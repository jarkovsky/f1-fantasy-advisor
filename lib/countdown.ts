/**
 * Pure time-formatting for the deadline countdown. The ticking lives in the
 * useCountdown hook; these functions never read a clock.
 */

export type Milestone = "mount" | "1h" | "15m" | "5m" | "1m" | "locked"

/** The coarse announcement bucket for a remaining duration. */
export function milestoneFor(remainingMs: number): Milestone {
  if (remainingMs <= 0) return "locked"
  const min = remainingMs / 60_000
  if (min <= 1) return "1m"
  if (min <= 5) return "5m"
  if (min <= 15) return "15m"
  if (min <= 60) return "1h"
  return "mount"
}

/** Coarse "2d 14h 33m" / "14h 33m" ≥1h; "14m 12s" under an hour. */
export function formatRemaining(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (remainingMs >= 3_600_000) {
    return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

/** The polite screen-reader announcement for a milestone. */
export function announce(milestone: Milestone, remainingMs: number): string {
  if (milestone === "locked") return "Team locked."
  return `Lock in ${formatRemaining(remainingMs)}.`
}
