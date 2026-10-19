"use client"

import { Flag, OctagonX } from "lucide-react"

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

/** Inside the final hour the flag turns yellow. */
const FINAL_HOUR_MS = 60 * 60_000

type FlagState = "pending" | "green" | "yellow" | "red"

const FLAG: Record<FlagState, { title: string; panel: string }> = {
  pending: { title: "Team lock", panel: "bg-surface-2 text-muted-foreground" },
  green: { title: "Team open", panel: "bg-flag-green text-flag-green-foreground" },
  yellow: { title: "Final hour", panel: "bg-flag-yellow text-flag-yellow-foreground" },
  red: { title: "Team locked", panel: "bg-accent-f1-fill text-accent-f1-foreground" },
}

/**
 * The race widget's flag panel: live countdown to the team lock, colored like
 * a marshal's flag — green while transfers are open, yellow in the final hour,
 * red once locked. The panel title says the same in words, so the color never
 * carries the state alone.
 *
 * Mount-gated (useCountdown): server render and the first client render show a
 * neutral "Locks at —" placeholder, so there is no hydration mismatch from a
 * wall-clock read. After mount it ticks once a second and freezes at the lock.
 *
 * Accessibility: the per-second text is aria-hidden (it would spam a screen
 * reader); a separate polite live region announces only at coarse milestones.
 */
export function DeadlineCountdown({ lockAtMs }: { lockAtMs: number }) {
  const { now, announcement } = useCountdown(lockAtMs)

  const remaining = now === null ? null : lockAtMs - now
  const flag: FlagState =
    remaining === null
      ? "pending"
      : remaining <= 0
        ? "red"
        : remaining < FINAL_HOUR_MS
          ? "yellow"
          : "green"
  const { title, panel } = FLAG[flag]
  const Icon = flag === "red" ? OctagonX : Flag

  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-3", panel)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-display text-xl leading-none font-extrabold uppercase [font-stretch:75%]">
          {title}
        </p>
        {remaining === null ? (
          <span className="font-mono text-sm">Locks at —</span>
        ) : (
          <span className="flex flex-col font-mono text-sm">
            <span aria-hidden="true" className="font-medium">
              {remaining <= 0 ? "Locked" : `Locks in ${formatRemaining(remaining)}`}
            </span>
            <span className="text-xs opacity-75">{lockFmt.format(lockAtMs)}</span>
          </span>
        )}
      </div>
      <Icon aria-hidden="true" className="size-6 shrink-0" />
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
