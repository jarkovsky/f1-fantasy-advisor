import { describe, expect, it } from "vitest"

import {
  fixtureAssets,
  fixtureConstraints,
  fixtureHistory,
  fixtureMixapi,
  fixtureWeekends,
} from "./fixtures"

// Pins the shared fixture helpers so component tests can rely on their shapes.

describe("fixture helpers", () => {
  it("fixtureAssets returns the 4 slimmed assets for every race", () => {
    for (let race = 1; race <= 6; race++) {
      const assets = fixtureAssets(race)
      expect(assets).toHaveLength(4)
      expect(assets.map((a) => a.playerId).sort()).toEqual([
        "131",
        "18",
        "28",
        "29",
      ])
    }
  })

  it("fixtureAssets throws on an unknown race", () => {
    expect(() => fixtureAssets(99)).toThrow()
  })

  it("fixtureConstraints points at race 6", () => {
    expect(fixtureConstraints().raceNumber).toBe(6)
  })

  it("fixtureWeekends includes race 6 (non-sprint) and race 7", () => {
    const weekends = fixtureWeekends()
    expect(weekends.map((w) => w.raceNumber)).toContain(6)
    expect(weekends.map((w) => w.raceNumber)).toContain(7)
    const race6 = weekends.find((w) => w.raceNumber === 6)
    expect(race6?.isSprint).toBe(false)
  })

  it("fixtureHistory assembles Gasly and Verstappen with race 6 pending", () => {
    const history = fixtureHistory()
    expect(history.pendingRace).toBe(6)
    expect(history.byPlayerId["18"]).toBeDefined() // Gasly
    expect(history.byPlayerId["131"]).toBeDefined() // Verstappen
    expect(history.raceNumbers).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("fixtureHistory honors upToRace", () => {
    const history = fixtureHistory(3)
    expect(history.raceNumbers).toEqual([1, 2, 3])
  })

  it("fixtureMixapi parses the live/maintenance flags", () => {
    const mixapi = fixtureMixapi()
    expect(mixapi.isLive).toBe(false)
    expect(mixapi.maintenance).toBe(false)
    expect(typeof mixapi.feedVersions.fixtures).toBe("string")
  })
})
