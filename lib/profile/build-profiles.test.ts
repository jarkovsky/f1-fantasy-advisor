import { describe, expect, it } from "vitest"

import { fixtureAssets, fixtureHistory } from "@/test/fixtures"

import { buildDriverProfiles, splitFullName } from "./build-profiles"

// Fixtures: Gasly (18) and Verstappen (131) plus two constructors, races 1–5
// scored and race 6 pending.
const profiles = buildDriverProfiles(fixtureAssets(6), fixtureHistory(), (id) => ({
  headshotPath: id === "131" ? "/headshots/131.png" : null,
  carNumber: id === "131" ? 3 : null,
}))

describe("buildDriverProfiles", () => {
  it("builds drivers only", () => {
    expect(Object.keys(profiles).sort()).toEqual(["131", "18"])
  })

  it("leaves the feed's inactive leftovers out of the grid", () => {
    const assets = fixtureAssets(6).map((a) => (a.playerId === "18" ? { ...a, active: false } : a))
    const out = buildDriverProfiles(assets, fixtureHistory(), () => ({
      headshotPath: null,
      carNumber: null,
    }))
    expect(Object.keys(out)).toEqual(["131"])
    expect(out["131"]).toMatchObject({ seasonRank: 1, gridSize: 1 })
  })

  it("takes names and birthplace from the feed and injects the asset lookups", () => {
    const ver = profiles["131"]
    expect(ver).toMatchObject({
      firstName: "Max",
      lastName: "Verstappen",
      tla: "VER",
      teamName: "Red Bull Racing",
      birthplace: "Hasselt, Belgium",
      carNumber: 3,
      headshotPath: "/headshots/131.png",
    })
    expect(profiles["18"]?.carNumber).toBeNull()
  })

  it("reports the current price with the season and last-race price moves", () => {
    // VER: 27.7 at race 1 → 28.3 → 28.4 now.
    expect(profiles["131"]).toMatchObject({
      priceTenths: 284,
      seasonPriceDeltaTenths: 7,
      lastPriceDeltaTenths: 1,
    })
    // GAS fell from 12.8 to 12.2 at the last change.
    expect(profiles["18"]?.lastPriceDeltaTenths).toBe(-6)
  })

  it("ranks season points and session averages across the grid", () => {
    // VER 50+14+13+52+26 = 155; GAS 11+20+14−8+16 = 53.
    expect(profiles["131"]).toMatchObject({ seasonPoints: 155, seasonRank: 1, gridSize: 2 })
    expect(profiles["18"]).toMatchObject({ seasonPoints: 53, seasonRank: 2, scoredRaces: 5 })
    // Race avg: VER (55−4+13+37+19)/5 = 24 tops GAS (11+16+10−15+13)/5 = 7.
    expect(profiles["131"]?.race).toEqual({ rank: 1, of: 2, rating: 5, avg: 24 })
    expect(profiles["18"]?.race).toEqual({ rank: 2, of: 2, rating: 3, avg: 7 })
  })

  it("derives sentiment from the selection trend", () => {
    // VER selection 18% (race 3) → 17% (race 6).
    expect(profiles["131"]?.sentiment).toEqual({ selectedPercent: 17, change: -1, races: 3 })
  })
})

describe("splitFullName", () => {
  it("treats the last word as the surname", () => {
    expect(splitFullName("Andrea Kimi Antonelli")).toEqual({
      first: "Andrea Kimi",
      last: "Antonelli",
    })
    expect(splitFullName("Zhou")).toEqual({ first: "", last: "Zhou" })
  })
})
