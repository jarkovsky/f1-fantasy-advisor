import type { TeamStateV1 } from "./types/team-state"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { INITIAL_BUDGET_TENTHS } from "@/lib/constants"

import { DEFAULT_STATE, teamStore } from "./store"

const KEY = "f1:v1"

// A complete, valid v1 payload — the shape we write back.
const VALID_V1: TeamStateV1 = {
  v: 1,
  roster: ["d1", "d2", "d3", "d4", "d5", "c1", "c2"],
  budgetTenths: 42,
  freeTransfers: 3,
  raceNumber: 7,
  activeChip: "wildcard",
  dismissedHonestyNote: true,
  savedProjection: { totalPoints: 123.5, preset: "form" },
}

const ROSTER7 = ["d1", "d2", "d3", "d4", "d5", "c1", "c2"]

beforeEach(() => {
  teamStore.__resetForTests()
  localStorage.clear()
})

afterEach(() => {
  teamStore.__resetForTests()
  localStorage.clear()
})

describe("snapshot identity", () => {
  it("getSnapshot() is reference-stable and equals getServerSnapshot before subscribe", () => {
    expect(teamStore.getSnapshot()).toBe(teamStore.getSnapshot())
    expect(teamStore.getServerSnapshot()).toBe(teamStore.getSnapshot())
    expect(teamStore.getServerSnapshot()).toBe(DEFAULT_STATE)
  })

  it("DEFAULT_STATE has the contracted pristine values and is frozen", () => {
    expect(Object.isFrozen(DEFAULT_STATE)).toBe(true)
    expect(DEFAULT_STATE).toEqual({
      v: 1,
      roster: null,
      budgetTenths: INITIAL_BUDGET_TENTHS,
      freeTransfers: "unlimited",
      raceNumber: null,
      activeChip: "none",
      dismissedHonestyNote: false,
      savedProjection: null,
    })
  })
})

describe("round-trip", () => {
  it("subscribe hydrates, setTeam updates the snapshot, localStorage holds versioned JSON", () => {
    const cb = vi.fn()
    const unsub = teamStore.subscribe(cb)

    teamStore.setTeam(ROSTER7, 80, 2, 5)

    const snap = teamStore.getSnapshot()
    expect(snap.roster).toEqual(ROSTER7)
    expect(snap.budgetTenths).toBe(80)
    expect(snap.freeTransfers).toBe(2)
    expect(snap.raceNumber).toBe(5)

    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.v).toBe(1)
    expect(parsed.roster).toEqual(ROSTER7)
    expect(parsed.budgetTenths).toBe(80)

    unsub()
  })

  it("setBudget / setFreeTransfers / applyPlan / dismissHonestyNote mutate as contracted", () => {
    teamStore.subscribe(() => {})

    teamStore.setBudget(15)
    expect(teamStore.getSnapshot().budgetTenths).toBe(15)

    teamStore.setFreeTransfers(3)
    expect(teamStore.getSnapshot().freeTransfers).toBe(3)

    teamStore.applyPlan(ROSTER7, 7, { totalPoints: 99, preset: "ewma" })
    const afterPlan = teamStore.getSnapshot()
    expect(afterPlan.roster).toEqual(ROSTER7)
    expect(afterPlan.budgetTenths).toBe(7)
    expect(afterPlan.savedProjection).toEqual({
      totalPoints: 99,
      preset: "ewma",
    })

    // applyPlan without a projection leaves the prior projection intact.
    teamStore.applyPlan(ROSTER7, 8)
    expect(teamStore.getSnapshot().savedProjection).toEqual({
      totalPoints: 99,
      preset: "ewma",
    })

    teamStore.dismissHonestyNote()
    expect(teamStore.getSnapshot().dismissedHonestyNote).toBe(true)
  })

  it("each mutation swaps the snapshot reference (Object.is changes)", () => {
    teamStore.subscribe(() => {})
    const before = teamStore.getSnapshot()
    teamStore.setBudget(1)
    expect(teamStore.getSnapshot()).not.toBe(before)
  })
})

describe("migration", () => {
  it("legacy v:0 → DEFAULT", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 0, roster: ROSTER7 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("unknown-future v:99 → DEFAULT", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 99, roster: ROSTER7 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("valid v1 is preserved through subscribe-hydration", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V1))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V1)
  })
})

describe("corrupt input never throws → DEFAULT", () => {
  const corrupt = ["{not json", "null", "[]", '{"v":1}']
  for (const raw of corrupt) {
    it(`handles ${JSON.stringify(raw)}`, () => {
      localStorage.setItem(KEY, raw)
      expect(() => teamStore.subscribe(() => {})).not.toThrow()
      expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
    })
  }

  it("rejects a v1 with a malformed field (roster length 6)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...VALID_V1, roster: ["a", "b", "c", "d", "e", "f"] })
    )
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("rejects a v1 with bad freeTransfers", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...VALID_V1, freeTransfers: 5 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("rejects a v1 with non-integer budgetTenths", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...VALID_V1, budgetTenths: 1.5 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })
})

describe("cross-tab sync", () => {
  it("StorageEvent for our key updates the snapshot and fires listeners", () => {
    const cb = vi.fn()
    teamStore.subscribe(cb)
    cb.mockClear() // ignore the hydration notify

    localStorage.setItem(KEY, JSON.stringify(VALID_V1))
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify(VALID_V1),
      })
    )

    expect(cb).toHaveBeenCalled()
    expect(teamStore.getSnapshot()).toEqual(VALID_V1)
  })

  it("StorageEvent for a DIFFERENT key is ignored", () => {
    const cb = vi.fn()
    teamStore.subscribe(cb)
    cb.mockClear()

    window.dispatchEvent(new StorageEvent("storage", { key: "other:key", newValue: "x" }))

    expect(cb).not.toHaveBeenCalled()
  })
})

describe("unsubscribe detaches", () => {
  it("after unsubscribe the storage listener no longer invokes the callback", () => {
    const cb = vi.fn()
    const unsub = teamStore.subscribe(cb)
    cb.mockClear()
    unsub()

    localStorage.setItem(KEY, JSON.stringify(VALID_V1))
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify(VALID_V1),
      })
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it("StrictMode-style double subscribe/unsubscribe is symmetric", () => {
    const cb = vi.fn()
    const a = teamStore.subscribe(cb)
    const b = teamStore.subscribe(cb)
    a()
    b()
    // No window listener should remain → a later event must not call cb.
    cb.mockClear()
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: "{}" }))
    expect(cb).not.toHaveBeenCalled()
  })
})

describe("quota / blocked storage degrades silently", () => {
  it("setItem throwing does not throw and still updates the in-memory snapshot", () => {
    teamStore.subscribe(() => {})
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError")
    })

    expect(() => teamStore.setTeam(ROSTER7, 50, 2, 9)).not.toThrow()
    expect(teamStore.getSnapshot().roster).toEqual(ROSTER7)
    expect(teamStore.getSnapshot().raceNumber).toBe(9)

    spy.mockRestore()
  })
})

describe("race-stamp semantics", () => {
  it("setTeam stamps the raceNumber", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(ROSTER7, 50, 2, 4)
    expect(teamStore.getSnapshot().raceNumber).toBe(4)
  })

  it("confirmRollover bumps the raceNumber (ROLLOVER → OPEN trigger)", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(ROSTER7, 50, 2, 4)
    teamStore.confirmRollover({
      roster: ROSTER7,
      budgetTenths: 30,
      freeTransfers: 3,
      raceNumber: 5,
      activeChip: "limitless",
    })
    const snap = teamStore.getSnapshot()
    expect(snap.raceNumber).toBe(5)
    expect(snap.budgetTenths).toBe(30)
    expect(snap.freeTransfers).toBe(3)
    expect(snap.activeChip).toBe("limitless")
  })

  it("reset returns DEFAULT and removes the key", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(ROSTER7, 50, 2, 4)
    expect(localStorage.getItem(KEY)).not.toBeNull()

    teamStore.reset()
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe("hydration laziness", () => {
  it("a seeded value is NOT reflected before subscribe (still DEFAULT reference)", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V1))
    // No subscribe yet → no localStorage read.
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)

    // First subscribe triggers the lazy read.
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V1)
  })

  it("first subscribe notifies listeners (so islands flip off the skeleton)", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V1))
    const cb = vi.fn()
    teamStore.subscribe(cb)
    expect(cb).toHaveBeenCalled()
  })
})
