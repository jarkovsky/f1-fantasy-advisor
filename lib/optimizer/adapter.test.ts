import type { RacePayload } from "@/lib/f1/types/history"
import type { OptimizerAsset } from "./types/optimizer"

import { describe, expect, it } from "vitest"

import race1 from "@/lib/f1/__fixtures__/drivers.race1.json"
import race2 from "@/lib/f1/__fixtures__/drivers.race2.json"
import race3 from "@/lib/f1/__fixtures__/drivers.race3.json"
import race4 from "@/lib/f1/__fixtures__/drivers.race4.json"
import race5 from "@/lib/f1/__fixtures__/drivers.race5.json"
import race6 from "@/lib/f1/__fixtures__/drivers.race6.json"
import { projectAssets } from "@/lib/projections/engine"
import { parseDriversFeed } from "@/lib/f1/schemas"
import { assembleHistory } from "@/lib/f1/history"

import { reconcileLineup, toOptimizerAssets } from "./adapter"
import { optimize } from "./optimize"

// ---------------------------------------------------------------------------
// Minimal grid asset (structural subset of domain Asset the adapter consumes).
// ---------------------------------------------------------------------------

type GridAsset = {
  playerId: string
  kind: "driver" | "constructor"
  priceTenths: number
}

const GRID: GridAsset[] = [
  { playerId: "d0", kind: "driver", priceTenths: 122 },
  { playerId: "d1", kind: "driver", priceTenths: 284 },
  { playerId: "c0", kind: "constructor", priceTenths: 308 },
  { playerId: "c1", kind: "constructor", priceTenths: 293 },
]

describe("toOptimizerAssets", () => {
  it("maps fields exactly (playerId→id, kind, priceTenths, totals→projected)", () => {
    const totals = { d0: 7.5, d1: 26.4, c0: 85.6, c1: 33.6 }
    expect(toOptimizerAssets(GRID, totals)).toEqual([
      { id: "d0", kind: "driver", priceTenths: 122, projected: 7.5 },
      { id: "d1", kind: "driver", priceTenths: 284, projected: 26.4 },
      { id: "c0", kind: "constructor", priceTenths: 308, projected: 85.6 },
      { id: "c1", kind: "constructor", priceTenths: 293, projected: 33.6 },
    ])
  })

  it("a missing total degrades to projected 0 (asset is never dropped)", () => {
    const result = toOptimizerAssets(GRID, { d0: 7.5 })
    expect(result).toHaveLength(GRID.length)
    expect(result.find((a) => a.id === "d1")?.projected).toBe(0)
    expect(result.find((a) => a.id === "c0")?.projected).toBe(0)
    expect(result.find((a) => a.id === "c1")?.projected).toBe(0)
  })

  it("ignores phantom totals with no matching asset", () => {
    const result = toOptimizerAssets(GRID, { d0: 1, ghost: 999, other: 5 })
    expect(result).toHaveLength(GRID.length)
    expect(result.map((a) => a.id)).not.toContain("ghost")
    expect(result.map((a) => a.id)).not.toContain("other")
  })

  it("length equals the input length", () => {
    expect(toOptimizerAssets(GRID, {})).toHaveLength(GRID.length)
  })

  it("preserves input order", () => {
    expect(toOptimizerAssets(GRID, {}).map((a) => a.id)).toEqual(["d0", "d1", "c0", "c1"])
  })

  it("preserves integer money (Number.isInteger on every priceTenths)", () => {
    const result = toOptimizerAssets(GRID, { d0: 7.123456 })
    for (const a of result) expect(Number.isInteger(a.priceTenths)).toBe(true)
  })
})

// ---------------------------------------------------------------------------

const OPT_GRID: OptimizerAsset[] = [
  { id: "d0", kind: "driver", priceTenths: 122, projected: 7 },
  { id: "d1", kind: "driver", priceTenths: 284, projected: 26 },
  { id: "d2", kind: "driver", priceTenths: 200, projected: 18 },
  { id: "d3", kind: "driver", priceTenths: 150, projected: 12 },
  { id: "d4", kind: "driver", priceTenths: 90, projected: 6 },
  { id: "c0", kind: "constructor", priceTenths: 308, projected: 85 },
  { id: "c1", kind: "constructor", priceTenths: 293, projected: 33 },
  { id: "c2", kind: "constructor", priceTenths: 120, projected: 20 },
]

describe("reconcileLineup", () => {
  it("fully resolvable lineup → no placeholders, empty unresolvedIds", () => {
    const lineup = ["d0", "d1", "d2", "d3", "d4", "c0", "c1"]
    const { assets, unresolvedIds } = reconcileLineup(lineup, OPT_GRID)
    expect(unresolvedIds).toEqual([])
    expect(assets).toEqual(OPT_GRID)
  })

  it("one missing driver → one driver-kind placeholder (price 0, projected 0)", () => {
    const lineup = ["gone", "d1", "d2", "d3", "d4", "c0", "c1"]
    const { assets, unresolvedIds } = reconcileLineup(lineup, OPT_GRID)
    expect(unresolvedIds).toEqual(["gone"])
    const placeholder = assets.find((a) => a.id === "gone")
    expect(placeholder).toEqual({
      id: "gone",
      kind: "driver",
      priceTenths: 0,
      projected: 0,
    })
    expect(assets).toHaveLength(OPT_GRID.length + 1)
  })

  it("one missing of each kind → kinds inferred by deficit", () => {
    // 4 resolved drivers + 1 resolved constructor → deficits 1 driver, 1 con.
    const lineup = ["d0", "d1", "d2", "d3", "goneD", "c0", "goneC"]
    const { assets, unresolvedIds } = reconcileLineup(lineup, OPT_GRID)
    expect(unresolvedIds).toEqual(["goneD", "goneC"])
    expect(assets.find((a) => a.id === "goneD")?.kind).toBe("driver")
    expect(assets.find((a) => a.id === "goneC")?.kind).toBe("constructor")
    for (const id of ["goneD", "goneC"]) {
      const ph = assets.find((a) => a.id === id)
      expect(ph?.priceTenths).toBe(0)
      expect(ph?.projected).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Integration smoke: real fixtures → projections → adapter → optimize().
// The fixtures hold only 4 assets (2 drivers + 2 constructors), so the grid is
// padded with plain literals to reach the optimizer's 5-driver / 2-constructor
// floor; the fixture-derived rows carry the real projected points.
// ---------------------------------------------------------------------------

function payload(raceNumber: number, fixture: unknown): RacePayload {
  const res = parseDriversFeed(fixture)
  if (!res.ok) throw new Error(res.summary.join("; "))
  return { raceNumber, assets: res.data }
}

const SEASON = assembleHistory([
  payload(1, race1),
  payload(2, race2),
  payload(3, race3),
  payload(4, race4),
  payload(5, race5),
  payload(6, race6),
])

describe("integration smoke — fixtures → projections → adapter → optimize", () => {
  it("optimize() runs and best.transfers is an integer", () => {
    const projection = projectAssets(SEASON, { isSprint: false }, { preset: "weighted-recent" })
    const totals: Record<string, number> = {}
    for (const [id, p] of Object.entries(projection.byPlayerId)) {
      totals[id] = p.totalPoints
    }

    // Fixture assets are 18, 131 (drivers) + 28, 29 (constructors).
    const fixtureGrid: GridAsset[] = Object.values(SEASON.byPlayerId).map((h) => ({
      playerId: h.playerId,
      kind: h.kind,
      priceTenths: h.perRace[h.perRace.length - 1]?.priceTenths ?? 0,
    }))
    const fixtureAssets = toOptimizerAssets(fixtureGrid, totals)

    // Synthesize the rest of the grid as plain literals (need ≥5 drivers,
    // ≥2 constructors). Cheap fillers so a valid lineup is affordable.
    const padding: OptimizerAsset[] = [
      { id: "fill-d1", kind: "driver", priceTenths: 40, projected: 3 },
      { id: "fill-d2", kind: "driver", priceTenths: 40, projected: 3 },
      { id: "fill-d3", kind: "driver", priceTenths: 40, projected: 3 },
      { id: "fill-c1", kind: "constructor", priceTenths: 60, projected: 5 },
    ]
    const grid = [...fixtureAssets, ...padding]

    // Pick a valid 5+2 lineup from this grid: 2 fixture drivers + 3 fillers,
    // 1 fixture constructor + 1 filler constructor.
    const lineup = ["18", "131", "fill-d1", "fill-d2", "fill-d3", "28", "fill-c1"]

    const lineupCost = lineup.reduce((sum, id) => {
      const a = grid.find((g) => g.id === id)
      return sum + (a?.priceTenths ?? 0)
    }, 0)

    const result = optimize({
      assets: grid,
      lineup,
      remainingCostCapTenths: 1000 - lineupCost,
      freeTransfers: 2,
    })

    expect(Number.isInteger(result.best.transfers)).toBe(true)
  })
})
