"use client"

import type { RaceWeekConstraints, RaceWeekend } from "@/lib/f1/schemas"

import { useMemo } from "react"

import { deriveRaceWeekState, type RaceWeekState } from "@/lib/f1/raceweek"

/**
 * Derive the race-week state on the client. Returns null until the clock has
 * mounted and the store has hydrated, so the two inputs that must never be
 * prerendered (`now` and `storedRaceNumber`) never reach the server.
 */
export function useRaceWeekState(args: {
  now: number | null
  hydrated: boolean
  constraints: RaceWeekConstraints
  raceWeekends: RaceWeekend[]
  nextRacePublished: boolean
  live: boolean
  storedRaceNumber: number | null
}): RaceWeekState | null {
  const { now, hydrated, constraints, raceWeekends, nextRacePublished, live, storedRaceNumber } =
    args
  return useMemo(() => {
    if (now === null || !hydrated) return null
    return deriveRaceWeekState({
      now: new Date(now),
      constraints,
      raceWeekends,
      nextRacePublished,
      storedRaceNumber,
      live,
    })
  }, [now, hydrated, constraints, raceWeekends, nextRacePublished, live, storedRaceNumber])
}
