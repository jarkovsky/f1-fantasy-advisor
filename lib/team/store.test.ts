import type { TeamStateV2 } from "./types/team-state"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

import { INITIAL_COST_CAP_TENTHS } from "@/lib/constants"

import { DEFAULT_STATE, teamStore, useTeamStore } from "./store"

const KEY = "f1:v2"
const LEGACY_KEY = "f1:v1"

// A complete, valid v2 payload — the shape we write back.
const VALID_V2: TeamStateV2 = {
  v: 2,
  lineup: ["d1", "d2", "d3", "d4", "d5", "c1", "c2"],
  remainingCostCapTenths: 42,
  freeTransfers: 3,
  raceNumber: 7,
  activeChip: "wildcard",
  savedProjection: { totalPoints: 123.5, preset: "form" },
}

const LINEUP7 = ["d1", "d2", "d3", "d4", "d5", "c1", "c2"]

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
      v: 2,
      lineup: null,
      remainingCostCapTenths: INITIAL_COST_CAP_TENTHS,
      freeTransfers: "unlimited",
      raceNumber: null,
      activeChip: "none",
      savedProjection: null,
    })
  })
})

describe("round-trip", () => {
  it("subscribe hydrates, setTeam updates the snapshot, localStorage holds versioned JSON", () => {
    const cb = vi.fn()
    const unsub = teamStore.subscribe(cb)

    teamStore.setTeam(LINEUP7, 80, 2, 5)

    const snap = teamStore.getSnapshot()
    expect(snap.lineup).toEqual(LINEUP7)
    expect(snap.remainingCostCapTenths).toBe(80)
    expect(snap.freeTransfers).toBe(2)
    expect(snap.raceNumber).toBe(5)

    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.v).toBe(2)
    expect(parsed.lineup).toEqual(LINEUP7)
    expect(parsed.remainingCostCapTenths).toBe(80)

    unsub()
  })

  it("applyPlan writes its fields to the snapshot", () => {
    teamStore.subscribe(() => {})

    teamStore.applyPlan(LINEUP7, 7, { totalPoints: 99, preset: "ewma" })
    const afterPlan = teamStore.getSnapshot()
    expect(afterPlan.lineup).toEqual(LINEUP7)
    expect(afterPlan.remainingCostCapTenths).toBe(7)
    expect(afterPlan.savedProjection).toEqual({
      totalPoints: 99,
      preset: "ewma",
    })

    // applyPlan without a projection leaves the prior projection intact.
    teamStore.applyPlan(LINEUP7, 8)
    expect(teamStore.getSnapshot().savedProjection).toEqual({
      totalPoints: 99,
      preset: "ewma",
    })
  })

  it("each mutation swaps the snapshot reference (Object.is changes)", () => {
    teamStore.subscribe(() => {})
    const before = teamStore.getSnapshot()
    teamStore.applyPlan(LINEUP7, 7)
    expect(teamStore.getSnapshot()).not.toBe(before)
  })
})

describe("migration", () => {
  it("legacy v:0 → DEFAULT", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 0, lineup: LINEUP7 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("unknown-future v:99 → DEFAULT", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 99, lineup: LINEUP7 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("valid v2 is preserved through subscribe-hydration", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V2)
  })
})

describe("corrupt input never throws → DEFAULT", () => {
  const corrupt = ["{not json", "null", "[]", '{"v":2}']
  for (const raw of corrupt) {
    it(`handles ${JSON.stringify(raw)}`, () => {
      localStorage.setItem(KEY, raw)
      expect(() => teamStore.subscribe(() => {})).not.toThrow()
      expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
    })
  }

  it("rejects a v2 with a malformed field (lineup length 6)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...VALID_V2, lineup: ["a", "b", "c", "d", "e", "f"] })
    )
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("rejects a v1 with bad freeTransfers", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...VALID_V2, freeTransfers: 5 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })

  it("rejects a v1 with non-integer remainingCostCapTenths", () => {
    localStorage.setItem(KEY, JSON.stringify({ ...VALID_V2, remainingCostCapTenths: 1.5 }))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
  })
})

describe("cross-tab sync", () => {
  it("StorageEvent for our key updates the snapshot and fires listeners", () => {
    const cb = vi.fn()
    teamStore.subscribe(cb)
    cb.mockClear() // ignore the hydration notify

    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify(VALID_V2),
      })
    )

    expect(cb).toHaveBeenCalled()
    expect(teamStore.getSnapshot()).toEqual(VALID_V2)
  })

  it("StorageEvent for a different key is ignored", () => {
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

    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify(VALID_V2),
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

    expect(() => teamStore.setTeam(LINEUP7, 50, 2, 9)).not.toThrow()
    expect(teamStore.getSnapshot().lineup).toEqual(LINEUP7)
    expect(teamStore.getSnapshot().raceNumber).toBe(9)

    spy.mockRestore()
  })
})

describe("race-stamp semantics", () => {
  it("setTeam stamps the raceNumber", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(LINEUP7, 50, 2, 4)
    expect(teamStore.getSnapshot().raceNumber).toBe(4)
  })

  it("confirmRollover bumps the raceNumber (ROLLOVER → OPEN trigger)", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(LINEUP7, 50, 2, 4)
    teamStore.confirmRollover({
      lineup: LINEUP7,
      remainingCostCapTenths: 30,
      freeTransfers: 3,
      raceNumber: 5,
      activeChip: "limitless",
    })
    const snap = teamStore.getSnapshot()
    expect(snap.raceNumber).toBe(5)
    expect(snap.remainingCostCapTenths).toBe(30)
    expect(snap.freeTransfers).toBe(3)
    expect(snap.activeChip).toBe("limitless")
  })

  it("reset returns DEFAULT and removes the key", () => {
    teamStore.subscribe(() => {})
    teamStore.setTeam(LINEUP7, 50, 2, 4)
    expect(localStorage.getItem(KEY)).not.toBeNull()

    teamStore.reset()
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe("hydration laziness", () => {
  it("a seeded value is not read before the first subscribe", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    // No subscribe yet → no localStorage read.
    expect(teamStore.getSnapshot()).toBe(DEFAULT_STATE)

    // First subscribe triggers the lazy read.
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V2)
  })

  it("first subscribe notifies listeners (so islands flip off the skeleton)", () => {
    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    const cb = vi.fn()
    teamStore.subscribe(cb)
    expect(cb).toHaveBeenCalled()
  })

  it("useTeamStore reports hydrated after mount even when storage is empty", () => {
    // An empty store hydrates to the same DEFAULT_STATE reference, so the
    // snapshot alone never changes; the flag must still re-render the island.
    const { result } = renderHook(() => useTeamStore())
    expect(result.current.hydrated).toBe(true)
  })
})

describe("v1 → v2 migration", () => {
  // A v1 save as written before the official-vocabulary renames, including
  // the since-removed honesty-note flag, which loading must ignore.
  const { lineup, remainingCostCapTenths, ...shared } = VALID_V2
  const V1_SAVE = {
    ...shared,
    v: 1,
    roster: lineup,
    budgetTenths: remainingCostCapTenths,
    dismissedHonestyNote: true,
  }

  it("reads a v1 save under the legacy key and renames its fields forward", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(V1_SAVE))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V2)
  })

  it("replaces the v1 save with v2 on the next write", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(V1_SAVE))
    teamStore.subscribe(() => {})
    teamStore.applyPlan(lineup as string[], remainingCostCapTenths)
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toMatchObject({ v: 2, lineup })
  })

  it("prefers a v2 save over a stale v1 one", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...V1_SAVE, raceNumber: 1 }))
    localStorage.setItem(KEY, JSON.stringify(VALID_V2))
    teamStore.subscribe(() => {})
    expect(teamStore.getSnapshot()).toEqual(VALID_V2)
  })
})
