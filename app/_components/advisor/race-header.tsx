"use client"

import type { RaceSession } from "@/lib/f1/schemas"

import { cn } from "@/lib/utils"

import { DeadlineCountdown } from "@/app/_components/advisor/deadline-countdown"
import { CountryFlag } from "@/app/_components/shared/country-flag"

type RaceHeaderProps = {
  raceNumber: number
  gpName: string
  circuitLocation: string
  country: string | null
  isSprint: boolean
  sessions: RaceSession[]
  lockAtMs: number
  className?: string
}

const sessionFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * The race-week widget: a carbon title bar (round + weekend format), the Grand
 * Prix in condensed display caps with the host country's flag, the session
 * timetable, and the flag panel counting down to the team lock. Sits in the
 * widget row under the team comparison, so it fills its grid cell's height.
 *
 * Hydration: session times are formatted in the user's local zone (no explicit
 * timeZone). That is only safe because this component renders post-mount
 * inside the advisor island (the panel gates it behind raceState !== null,
 * which is itself mount-gated), so the server never produces this markup and
 * there is nothing to mismatch.
 */
export function RaceHeader({
  raceNumber,
  gpName,
  circuitLocation,
  country,
  isSprint,
  sessions,
  lockAtMs,
  className,
}: RaceHeaderProps) {
  return (
    <section
      aria-labelledby="race-header-title"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-surface-1 shadow-xs ring-1 ring-grid-line",
        className
      )}
    >
      <div className="dark flex items-center justify-between bg-surface-0 px-4 py-2 font-display text-sm font-extrabold tracking-wide text-foreground uppercase [font-stretch:75%]">
        <span>Round {raceNumber}</span>
        <span className={isSprint ? "text-accent-f1" : undefined}>
          {isSprint ? "Sprint weekend" : "Race weekend"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          {/* h2: the page hero owns the h1. */}
          <h2
            id="race-header-title"
            className="font-display text-2xl leading-none font-extrabold text-balance uppercase [font-stretch:75%]"
          >
            {gpName}
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CountryFlag country={country} />
            {circuitLocation}
          </p>
        </div>

        <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
          {sessions.map((s) => (
            <li
              key={`${s.session}-${s.startsAtMs}`}
              className="flex justify-between gap-3 tabular-nums"
            >
              <span className="text-foreground">{s.session}</span>
              {sessionFmt.format(s.startsAtMs)}
            </li>
          ))}
        </ul>
      </div>

      <DeadlineCountdown lockAtMs={lockAtMs} />
    </section>
  )
}
