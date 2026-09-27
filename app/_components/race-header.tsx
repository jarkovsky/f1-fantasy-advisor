"use client"

import { DeadlineCountdown } from "@/app/_components/deadline-countdown"
import { Badge } from "@/components/ui/badge"
import type { RaceSession } from "@/lib/f1/schemas"

/**
 * The race-week header: Grand Prix name, circuit, a SPRINT marker, the compact
 * session timetable, and the live countdown slot.
 *
 * HYDRATION NOTE: the session times are formatted with Intl.DateTimeFormat in
 * the user's local zone (NO explicit timeZone). That is only safe because this
 * component renders POST-MOUNT inside the advisor island (the panel gates it
 * behind raceState !== null, which is itself mount-gated), so the server never
 * produces this markup and there is nothing to mismatch.
 */
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
        {/* h2: the page hero owns the h1 (M5 single-column redesign). */}
        <h2 className="text-2xl font-semibold">{gpName}</h2>
        {isSprint && <Badge variant="sprint">SPRINT</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{circuitLocation}</p>

      <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
        {sessions.map((s) => (
          <li key={`${s.session}-${s.startsAtMs}`} className="tabular-nums">
            <span className="text-foreground">{s.session}</span>{" "}
            {sessionFmt.format(s.startsAtMs)}
          </li>
        ))}
      </ul>

      <DeadlineCountdown lockAtMs={lockAtMs} />
    </header>
  )
}
