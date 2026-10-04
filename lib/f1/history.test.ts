import { describe, expect, it } from "vitest"

import race1 from "./__fixtures__/drivers.race1.json"
import race2 from "./__fixtures__/drivers.race2.json"
import race3 from "./__fixtures__/drivers.race3.json"
import race4 from "./__fixtures__/drivers.race4.json"
import race5 from "./__fixtures__/drivers.race5.json"
import race6 from "./__fixtures__/drivers.race6.json"
import { assembleHistory, type RacePayload } from "./history"
import { type Asset, parseDriversFeed } from "./schemas"

// Fixtures: same 4 real assets (Gasly 18, Verstappen 131, Mercedes 28,
// Red Bull 29) across all six races, captured 2026-06-05. Race 6 (Monaco)
// is pre-race/pending.

function payload(raceNumber: number, fixture: unknown): RacePayload {
  const res = parseDriversFeed(fixture)
  if (!res.ok) throw new Error(res.summary.join("; "))
  return { raceNumber, assets: res.data }
}

const ALL = [
  payload(1, race1),
  payload(2, race2),
  payload(3, race3),
  payload(4, race4),
  payload(5, race5),
  payload(6, race6),
]

describe("assembleHistory — cumulative recompute (the contamination fix)", () => {
  it("recomputes Gasly's season total from per-race points", () => {
    const history = assembleHistory(ALL).byPlayerId["18"]
    if (!history) throw new Error("no Gasly")
    // 11 + 20 + 14 - 8 + 16 = 53 scored; race 6 pending contributes nothing
    expect(history.cumulativePoints).toBe(53)
    expect(history.cumulativeByRace).toEqual([
      { raceNumber: 1, cumulative: 11 },
      { raceNumber: 2, cumulative: 31 },
      { raceNumber: 3, cumulative: 45 },
      { raceNumber: 4, cumulative: 37 },
      { raceNumber: 5, cumulative: 53 },
    ])
  })

  it("the race-4 running sum differs from the feed's contaminated season total", () => {
    // The raw race-4 fixture says OverallPpints '53.00' (regenerated at race-5 time).
    const raw = (race4.Data.Value as { PlayerId: string; OverallPpints: string }[]).find(
      (a) => a.PlayerId === "18"
    )
    expect(raw?.OverallPpints).toBe("53.00") // what the feed CLAIMS at race 4
    const history = assembleHistory(ALL).byPlayerId["18"]
    const atRace4 = history?.cumulativeByRace.find((c) => c.raceNumber === 4)
    expect(atRace4?.cumulative).toBe(37) // what it actually was
  })
})

describe("assembleHistory — pending current race", () => {
  it("includes the pre-race week as pending, excluded from cumulative", () => {
    const season = assembleHistory(ALL)
    expect(season.pendingRace).toBe(6)
    const ver = season.byPlayerId["131"]
    if (!ver) throw new Error("no Verstappen")
    expect(ver.perRace).toHaveLength(6)
    expect(ver.perRace[5]?.status).toBe("pending")
    expect(ver.perRace[5]?.points).toBeNull()
    expect(ver.cumulativePoints).toBe(50 + 14 + 13 + 52 + 26) // 155, race 6 excluded
  })

  it("latestAdditionalStats comes from the latest SCORED race", () => {
    const season = assembleHistory(ALL)
    expect(season.byPlayerId["18"]?.latestAdditionalStats).not.toBeNull()
  })
})

describe("assembleHistory — prices", () => {
  it("priceDeltaTenths spans first to latest race", () => {
    const gasly = assembleHistory(ALL).byPlayerId["18"]
    // 12.0 → 12.2 over the season
    expect(gasly?.priceDeltaTenths).toBe(122 - 120)
  })

  it("the real price chain holds (no warnings from fixtures)", () => {
    const season = assembleHistory(ALL)
    expect(season.warnings).toEqual([])
  })

  it("a broken price chain produces a warning, not a throw", () => {
    const tampered = ALL.map((p) => ({
      raceNumber: p.raceNumber,
      assets: p.assets.map((a): Asset => ({ ...a })),
    }))
    const ver = tampered[2]?.assets.find((a) => a.playerId === "131")
    if (!ver) throw new Error("no Verstappen in race 3")
    ver.prevPriceTenths = 999
    const season = assembleHistory(tampered)
    expect(season.warnings.some((w) => w.includes("131"))).toBe(true)
  })
})

describe("assembleHistory — robustness", () => {
  it("mid-season swap: asset present in some races only, no zero-fill", () => {
    const partial = [
      payload(1, race1),
      { raceNumber: 2, assets: [] }, // asset missing entirely at race 2
      payload(3, race3),
    ]
    const gasly = assembleHistory(partial).byPlayerId["18"]
    expect(gasly?.perRace.map((p) => p.raceNumber)).toEqual([1, 3])
    // gap means the race-3 chain check is skipped (no false warning)
    expect(assembleHistory(partial).warnings.filter((w) => w.includes("price chain"))).toEqual([])
  })

  it("duplicate races are dropped with a warning", () => {
    const season = assembleHistory([payload(1, race1), payload(1, race1)])
    expect(season.raceNumbers).toEqual([1])
    expect(season.warnings.some((w) => w.includes("duplicate"))).toBe(true)
  })

  it("unsorted input is handled", () => {
    const season = assembleHistory([payload(3, race3), payload(1, race1), payload(2, race2)])
    expect(season.raceNumbers).toEqual([1, 2, 3])
    expect(season.byPlayerId["18"]?.cumulativePoints).toBe(45)
  })
})
