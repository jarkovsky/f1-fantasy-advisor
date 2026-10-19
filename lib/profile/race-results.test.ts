import type { AssetHistory } from "@/lib/f1/types/history"

import { describe, expect, it } from "vitest"

import { fixtureHistory, fixtureWeekends } from "@/test/fixtures"

import { headToHead, raceResults } from "./race-results"

const history = fixtureHistory()
const ver = history.byPlayerId["131"] as AssetHistory
const gas = history.byPlayerId["18"] as AssetHistory

describe("raceResults", () => {
  const rows = raceResults(ver, fixtureWeekends())

  it("lists the most recent race first", () => {
    expect(rows.map((r) => r.raceNumber)).toEqual([6, 5, 4, 3, 2, 1])
  })

  it("splits a scored weekend by session and names it from the schedule", () => {
    expect(rows[1]).toEqual({
      raceNumber: 5,
      gpName: "Canadian Grand Prix",
      country: "Canada",
      priceTenths: 283,
      quali: 5,
      sprint: 2,
      race: 19,
      total: 26,
    })
  })

  it("leaves a pending weekend and a missing sprint empty", () => {
    expect(rows[0]).toMatchObject({ raceNumber: 6, quali: null, race: null, total: null })
    expect(rows[3]).toMatchObject({ raceNumber: 3, sprint: null, total: 13 })
  })
})

describe("headToHead", () => {
  it("counts the weekends each teammate outscored the other", () => {
    // VER vs GAS: 50–11, 14–20, 13–14, 52–(−8), 26–16.
    expect(headToHead(ver, gas)).toEqual({ races: 5, ahead: 3, behind: 2 })
    expect(headToHead(gas, ver)).toEqual({ races: 5, ahead: 2, behind: 3 })
  })
})
