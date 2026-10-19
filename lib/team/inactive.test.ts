import type { AssetLite } from "@/lib/asset-lite"

import { describe, expect, it } from "vitest"

import { retireInactive } from "./inactive"

function asset(playerId: string, active: boolean): AssetLite {
  return {
    playerId,
    kind: "driver",
    displayName: playerId,
    fullName: playerId,
    tla: playerId.toUpperCase(),
    priceTenths: 150,
    prevPriceTenths: 150,
    selectedPercent: 1,
    boostedPercent: 0,
    constructorId: null,
    teamName: null,
    seasonPoints: 50,
    headshotPath: null,
    logo: null,
    active,
  }
}

const TOTALS = { law: 12, old: 8, gone: 5 }

describe("retireInactive", () => {
  it("returns the same references when every asset is active", () => {
    const assets = [asset("law", true)]
    const out = retireInactive(assets, TOTALS, ["law"])
    expect(out.assets).toBe(assets)
    expect(out.totals).toBe(TOTALS)
  })

  it("drops inactive assets the line-up doesn't hold", () => {
    const out = retireInactive(
      [asset("law", true), asset("old", false), asset("gone", false)],
      TOTALS,
      ["old"]
    )
    expect(out.assets.map((a) => a.playerId)).toEqual(["law", "old"])
  })

  it("keeps a held inactive asset at its price but projects it at 0", () => {
    const out = retireInactive([asset("law", true), asset("old", false)], TOTALS, ["old"])
    expect(out.assets.find((a) => a.playerId === "old")?.priceTenths).toBe(150)
    expect(out.totals).toEqual({ law: 12, old: 0, gone: 5 })
    // The input map is untouched.
    expect(TOTALS.old).toBe(8)
  })

  it("treats a first visit (no line-up) as holding nothing", () => {
    const out = retireInactive([asset("law", true), asset("old", false)], TOTALS, null)
    expect(out.assets.map((a) => a.playerId)).toEqual(["law"])
  })
})
