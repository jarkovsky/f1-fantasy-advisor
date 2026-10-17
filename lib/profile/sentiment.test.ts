import type { AssetRacePoint } from "@/lib/f1/types/history"

import { describe, expect, it } from "vitest"

import { selectionTrend, sentimentPosition } from "./sentiment"

function races(selected: number[]): AssetRacePoint[] {
  return selected.map((selectedPercent, i) => ({
    raceNumber: i + 1,
    priceTenths: 100,
    prevPriceTenths: 100,
    points: 10,
    sessionPoints: [],
    selectedPercent,
    status: "scored",
  }))
}

describe("selectionTrend", () => {
  it("measures the change over the last three races", () => {
    expect(selectionTrend(races([10, 12, 15, 20, 26]))).toEqual({
      selectedPercent: 26,
      change: 14,
      races: 3,
    })
  })

  it("spans the races available when the season is shorter than the window", () => {
    expect(selectionTrend(races([5, 3]))).toEqual({ selectedPercent: 3, change: -2, races: 1 })
  })

  it("has no trend with fewer than two races", () => {
    expect(selectionTrend(races([40]))).toEqual({ selectedPercent: 40, change: null, races: 0 })
    expect(selectionTrend([])).toEqual({ selectedPercent: 0, change: null, races: 0 })
  })
})

describe("sentimentPosition", () => {
  it("scales the change and pins at the ends", () => {
    expect(sentimentPosition(5)).toBe(0.5)
    expect(sentimentPosition(-2)).toBe(-0.2)
    expect(sentimentPosition(14)).toBe(1)
    expect(sentimentPosition(-30)).toBe(-1)
  })

  it("centers the needle with no data", () => {
    expect(sentimentPosition(null)).toBe(0)
    expect(sentimentPosition(0)).toBe(0)
  })
})
