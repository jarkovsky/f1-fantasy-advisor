/**
 * The race-week lifecycle state machine — the product's backbone. Without it,
 * by week two the advisor would confidently recommend transfers from a
 * lineup, Remaining Cost Cap, and transfer count the user no longer has.
 *
 * Pure: no Date.now(), no I/O. `now` is injected, so every boundary instant
 * is unit-testable.
 *
 * Derivation facts (verified live 2026-06-05):
 * - The real team lock is the current weekend's first-session start
 *   (RaceWeekend.lockAtMs from the raceday feed's ISO8601 fields).
 *   constraints.DeadlineDate is stale/advisory — never used here.
 * - constraints.raceNumber is the authoritative "which race" pointer;
 *   lastCompletedRace is the last scored round.
 */
import type { RaceWeekConstraints, RaceWeekend } from "./schemas"

import { RACE_STATUS } from "./config"

export type RaceWeekInput = {
  now: Date
  constraints: RaceWeekConstraints
  raceWeekends: RaceWeekend[]
  /** The race the user's saved team was entered for; null = first visit. */
  storedRaceNumber: number | null
  /** mixapi.isLive — refines LOCKED's `live` flag, never gates a state. */
  live?: boolean
}

export type RaceWeekState =
  | { kind: "FIRST_VISIT"; race: number; lockAtMs: number | null }
  | {
      kind: "OPEN"
      race: number
      gpName: string
      lockAtMs: number
      isSprint: boolean
    }
  | {
      kind: "LOCKED"
      race: number
      gpName: string
      raceEndsApproxMs: number
      live: boolean
    }
  | {
      kind: "BETWEEN_ROUNDS"
      lastCompleted: number
      nextRace: number
      nextLockAtMs: number | null
    }
  | { kind: "ROLLOVER"; from: number; to: number }
  | { kind: "SEASON_ENDED"; lastRace: number }

/**
 * Decision table — evaluated top to bottom, first match wins:
 *  1. FIRST_VISIT    storedRaceNumber === null
 *  2. ROLLOVER       stored < constraints.raceNumber (wins over OPEN: the user
 *                    confirms the migration before the new week is "open")
 *  3. SEASON_ENDED   last completed race ≥ season end
 *  4. LOCKED         lockAtMs ≤ now ≤ raceEndsApproxMs (any session weekend-wide)
 *  5. OPEN           now < lockAtMs and the weekend isn't completed
 *  6. BETWEEN_ROUNDS current round done, pointer not yet advanced
 *  7. fallback       BETWEEN_ROUNDS (feed disagreement — never throw)
 */
export function deriveRaceWeekState(input: RaceWeekInput): RaceWeekState {
  const { constraints, raceWeekends, storedRaceNumber } = input
  const nowMs = input.now.getTime()
  const current = raceWeekends.find((w) => w.raceNumber === constraints.raceNumber)

  // 1. FIRST_VISIT — nothing stored, nothing to reconcile.
  if (storedRaceNumber === null) {
    return {
      kind: "FIRST_VISIT",
      race: constraints.raceNumber,
      lockAtMs: current?.lockAtMs ?? null,
    }
  }

  // 2. ROLLOVER — the server pointer advanced past the saved team's race.
  if (storedRaceNumber < constraints.raceNumber) {
    return {
      kind: "ROLLOVER",
      from: storedRaceNumber,
      to: constraints.raceNumber,
    }
  }

  // 3. SEASON_ENDED.
  if (constraints.lastCompletedRace >= constraints.seasonEndRace) {
    return { kind: "SEASON_ENDED", lastRace: constraints.seasonEndRace }
  }

  if (current) {
    // 4. LOCKED — between the lock (first session) and the race end:
    // boundary semantics are ≥ at lock, ≤ at race end.
    if (nowMs >= current.lockAtMs && nowMs <= current.raceEndsApproxMs) {
      return {
        kind: "LOCKED",
        race: current.raceNumber,
        gpName: current.gpName,
        raceEndsApproxMs: current.raceEndsApproxMs,
        live: input.live ?? false,
      }
    }

    // 5. OPEN — before the lock, weekend not completed.
    if (nowMs < current.lockAtMs && current.status !== RACE_STATUS.COMPLETED) {
      return {
        kind: "OPEN",
        race: current.raceNumber,
        gpName: current.gpName,
        lockAtMs: current.lockAtMs,
        isSprint: current.isSprint,
      }
    }

    // 6. BETWEEN_ROUNDS — round done (status or clock), pointer not advanced.
    const completed =
      current.status === RACE_STATUS.COMPLETED ||
      nowMs > current.raceEndsApproxMs ||
      constraints.lastCompletedRace >= current.raceNumber
    if (completed) {
      const nextRace = current.raceNumber + 1
      const next = raceWeekends.find((w) => w.raceNumber === nextRace)
      return {
        kind: "BETWEEN_ROUNDS",
        lastCompleted: current.raceNumber,
        nextRace,
        nextLockAtMs: next?.lockAtMs ?? null,
      }
    }
  }

  // 7. Defensive fallback — constraints point at a race the schedule doesn't
  // know. Never throw; surface the most conservative state.
  return {
    kind: "BETWEEN_ROUNDS",
    lastCompleted: constraints.lastCompletedRace,
    nextRace: constraints.raceNumber,
    nextLockAtMs: null,
  }
}
