"use client"

import type { RaceSession } from "@/lib/f1/schemas"

import { Badge } from "@/components/ui/badge"

import { DeadlineCountdown } from "@/app/_components/advisor/deadline-countdown"

type RaceHeaderProps = {
  gpName: string
  circuitLocation: string
  isSprint: boolean
  sessions: RaceSession[]
  lockAtMs: number
}

const sessionFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * The race-week header: Grand Prix name, circuit, a sprint marker, the compact
 * session timetable, and the live countdown.
 *
 * Hydration: session times are formatted in the user's local zone (no explicit
 * timeZone). That is only safe because this component renders post-mount
 * inside the advisor island (the panel gates it behind raceState !== null,
 * which is itself mount-gated), so the server never produces this markup and
 * there is nothing to mismatch.
 */
export function RaceHeader({
  gpName,
  circuitLocation,
  isSprint,
  sessions,
  lockAtMs,
}: RaceHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* h2: the page hero owns the h1. */}
        <h2 className="text-2xl font-semibold">{gpName}</h2>
        {isSprint && <Badge variant="sprint">SPRINT</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{circuitLocation}</p>

      <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
        {sessions.map((s) => (
          <li key={`${s.session}-${s.startsAtMs}`} className="tabular-nums">
            <span className="text-foreground">{s.session}</span> {sessionFmt.format(s.startsAtMs)}
          </li>
        ))}
      </ul>

      <DeadlineCountdown lockAtMs={lockAtMs} />
    </header>
  )
}
