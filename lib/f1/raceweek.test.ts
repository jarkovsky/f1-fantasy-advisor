import { describe, expect, it } from "vitest"

import {
  type RaceWeekConstraints,
  type RaceWeekend,
  parseConstraints,
  parseRaceday,
} from "./schemas"
import { deriveRaceWeekState, type RaceWeekInput } from "./raceweek"
import constraintsFixture from "./__fixtures__/constraints.json"
import racedayFixture from "./__fixtures__/raceday.excerpt.json"

// Real Monaco race week (captured 2026-06-05):
//   race 6 lock  = 2026-06-06T16:00:00+02:00  (Saturday qualifying)
//   race 6 ends ≈ 2026-06-07T17:00:00+02:00  (Sunday race end)
//   race 7 lock  = 2026-06-13T16:00:00+02:00

const LOCK = Date.parse("2026-06-06T16:00:00+02:00")
const RACE_END = Date.parse("2026-06-07T17:00:00+02:00")
const RACE7_LOCK = Date.parse("2026-06-13T16:00:00+02:00")

function constraints(): RaceWeekConstraints {
  const res = parseConstraints(constraintsFixture)
  if (!res.ok) throw new Error("constraints fixture failed to parse")
  return res.data
}

function weekends(): RaceWeekend[] {
  const res = parseRaceday(racedayFixture)
  if (!res.ok) throw new Error("raceday fixture failed to parse")
  return res.data
}

function input(overrides: Partial<RaceWeekInput>): RaceWeekInput {
  return {
    now: new Date(LOCK - 60_000),
    constraints: constraints(),
    raceWeekends: weekends(),
    nextRacePublished: false,
    storedRaceNumber: 6,
    ...overrides,
  }
}

describe("deriveRaceWeekState — happy path through the Monaco weekend", () => {
  it("FIRST_VISIT when nothing is stored", () => {
    const state = deriveRaceWeekState(input({ storedRaceNumber: null }))
    expect(state).toEqual({ kind: "FIRST_VISIT", race: 6, lockAtMs: LOCK })
  })

  it("OPEN before the lock", () => {
    const state = deriveRaceWeekState(input({ now: new Date(LOCK - 1000) }))
    expect(state).toMatchObject({
      kind: "OPEN",
      race: 6,
      gpName: "Monaco Grand Prix",
      lockAtMs: LOCK,
      isSprint: false,
    })
  })

  it("LOCKED exactly at the lock instant (>= semantics)", () => {
    expect(deriveRaceWeekState(input({ now: new Date(LOCK) })).kind).toBe("LOCKED")
  })

  it("OPEN one second before, LOCKED one second after", () => {
    expect(deriveRaceWeekState(input({ now: new Date(LOCK - 1) })).kind).toBe("OPEN")
    expect(deriveRaceWeekState(input({ now: new Date(LOCK + 1) })).kind).toBe("LOCKED")
  })

  it("LOCKED mid-weekend (between quali and race)", () => {
    const sundayMorning = Date.parse("2026-06-07T10:00:00+02:00")
    const state = deriveRaceWeekState(input({ now: new Date(sundayMorning) }))
    expect(state).toMatchObject({
      kind: "LOCKED",
      raceEndsApproxMs: RACE_END,
      live: false,
    })
  })

  it("LOCKED carries the mixapi live flag", () => {
    const state = deriveRaceWeekState(input({ now: new Date(LOCK + 1), live: true }))
    expect(state).toMatchObject({ kind: "LOCKED", live: true })
  })

  it("LOCKED at the race-end instant (<= semantics), BETWEEN_ROUNDS after", () => {
    expect(deriveRaceWeekState(input({ now: new Date(RACE_END) })).kind).toBe("LOCKED")
    const after = deriveRaceWeekState(input({ now: new Date(RACE_END + 1) }))
    expect(after).toEqual({
      kind: "BETWEEN_ROUNDS",
      lastCompleted: 6,
      nextRace: 7,
      nextLockAtMs: RACE7_LOCK,
    })
  })
})

describe("deriveRaceWeekState — ROLLOVER precedence", () => {
  it("ROLLOVER when the stored race is behind, even inside an OPEN window", () => {
    const state = deriveRaceWeekState(input({ storedRaceNumber: 5, now: new Date(LOCK - 60_000) }))
    expect(state).toEqual({ kind: "ROLLOVER", from: 5, to: 6 })
  })

  it("after the user confirms (stored = current), the same instant is OPEN", () => {
    const state = deriveRaceWeekState(input({ storedRaceNumber: 6, now: new Date(LOCK - 60_000) }))
    expect(state.kind).toBe("OPEN")
  })

  it("FIRST_VISIT beats ROLLOVER (null stored is not a rollover)", () => {
    expect(deriveRaceWeekState(input({ storedRaceNumber: null })).kind).toBe("FIRST_VISIT")
  })
})

describe("deriveRaceWeekState — season boundaries & fallbacks", () => {
  it("SEASON_ENDED when the last race is completed", () => {
    const done = { ...constraints(), raceNumber: 22, lastCompletedRace: 22 }
    const state = deriveRaceWeekState(input({ constraints: done, storedRaceNumber: 22 }))
    expect(state).toEqual({ kind: "SEASON_ENDED", lastRace: 22 })
  })

  it("BETWEEN_ROUNDS when the pointer still sits on a completed race", () => {
    // Simulate post-Canada (race 5 completed, pointer not yet advanced):
    const c = { ...constraints(), raceNumber: 5, lastCompletedRace: 5 }
    const monday = Date.parse("2026-05-25T10:00:00Z")
    const state = deriveRaceWeekState(
      input({ constraints: c, storedRaceNumber: 5, now: new Date(monday) })
    )
    expect(state).toEqual({
      kind: "BETWEEN_ROUNDS",
      lastCompleted: 5,
      nextRace: 6,
      nextLockAtMs: LOCK,
    })
  })

  it("fallback: constraints point at a race the schedule doesn't know", () => {
    const c = { ...constraints(), raceNumber: 99 }
    const state = deriveRaceWeekState(input({ constraints: c, storedRaceNumber: 99 }))
    expect(state).toEqual({
      kind: "BETWEEN_ROUNDS",
      lastCompleted: 5,
      nextRace: 99,
      nextLockAtMs: null,
    })
  })

  it("never throws on an empty schedule", () => {
    const state = deriveRaceWeekState(input({ raceWeekends: [] }))
    expect(state.kind).toBe("BETWEEN_ROUNDS")
  })
})
