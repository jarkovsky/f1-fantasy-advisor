import type { AssetProjection, ProjectionResult } from "@/lib/projections/types/projection"
import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { AssetLite } from "@/lib/asset-lite"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import userEvent from "@testing-library/user-event"

import { reconcileLineup, toOptimizerAssets } from "@/lib/optimizer/adapter"
import { optimize } from "@/lib/optimizer/optimize"

import { Alternatives } from "./alternatives"

function driver(n: number, priceTenths: number): AssetLite {
  return {
    playerId: `d${n}`,
    kind: "driver",
    displayName: `Driver ${n}`,
    fullName: `Firstname Lastname${n}`,
    tla: `D0${n}`,
    priceTenths,
    prevPriceTenths: priceTenths,
    selectedPercent: 10,
    boostedPercent: n,
    constructorId: `c${((n - 1) % 3) + 1}`,
    teamName: "Team",
    seasonPoints: 100,
    headshotPath: null,
    logo: null,
  }
}
function constructor(n: number, priceTenths: number): AssetLite {
  return {
    playerId: `c${n}`,
    kind: "constructor",
    displayName: `Constructor ${n}`,
    fullName: `Constructor ${n} Full`,
    tla: `C0${n}`,
    priceTenths,
    prevPriceTenths: priceTenths,
    selectedPercent: 5,
    boostedPercent: 0,
    constructorId: null,
    teamName: `Constructor ${n} Full`,
    seasonPoints: 200,
    headshotPath: null,
    logo: null,
  }
}

const GRID: AssetLite[] = [
  ...Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20)),
  constructor(1, 250),
  constructor(2, 200),
  constructor(3, 150),
]
const ASSETS_BY_ID = Object.fromEntries(GRID.map((a) => [a.playerId, a]))
const TOTALS: Record<string, number> = {
  d1: 100,
  d2: 90,
  d3: 80,
  d4: 70,
  d5: 60,
  d6: 50,
  d7: 40,
  d8: 30,
  c1: 45,
  c2: 35,
  c3: 25,
}
const LINEUP = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

function makeProjection(): ProjectionResult {
  const byPlayerId: Record<string, AssetProjection> = {}
  for (const a of GRID) {
    const t = TOTALS[a.playerId] ?? 0
    byPlayerId[a.playerId] = {
      playerId: a.playerId,
      kind: a.kind,
      totalPoints: t,
      perSession: [
        { session: "Qualifying", expected: t * 0.4, basisRaces: 5 },
        { session: "Race", expected: t * 0.6, basisRaces: 5 },
      ],
      source: "weighted-recent",
      basis: { completedRaces: 5, completedSprints: 3 },
    }
  }
  return {
    byPlayerId,
    requestedPreset: "weighted-recent",
    effectivePreset: "weighted-recent",
    basis: { completedRaces: 5, completedSprints: 3 },
    coldStart: false,
    notes: [],
  }
}

function build(): { result: OptimizerResult; baseline: TeamPlan | null } {
  const grid = toOptimizerAssets(GRID, TOTALS)
  const { assets } = reconcileLineup(LINEUP, grid)
  const result = optimize({
    assets,
    lineup: LINEUP,
    remainingCostCapTenths: 500,
    freeTransfers: 2,
    mode: "normal",
  })
  return { result, baseline: result.byTransferCount[0] ?? null }
}

afterEach(cleanup)

describe("Alternatives", () => {
  it("renders one row per non-null transfer bucket and marks the recommended one", async () => {
    const user = userEvent.setup()
    const { result, baseline } = build()
    render(
      <Alternatives
        result={result}
        baseline={baseline}
        assetsById={ASSETS_BY_ID}
        projection={makeProjection()}
      />
    )

    await user.click(screen.getByRole("button", { name: /Other transfer counts/i }))

    const buckets = result.byTransferCount.filter((p): p is TeamPlan => p !== null)
    for (const bucket of buckets) {
      const label = `${bucket.transfers} transfer${bucket.transfers === 1 ? "" : "s"}`
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Exactly one bucket carries the Recommended badge: the optimizer's pick.
    const badge = screen.getByText("Recommended")
    const best = `${result.best.transfers} transfer${result.best.transfers === 1 ? "" : "s"}`
    expect(badge.closest("button")).toHaveTextContent(best)
  })

  it("expands a bucket to show the projection math and states the sample size", async () => {
    const user = userEvent.setup()
    const { result, baseline } = build()
    render(
      <Alternatives
        result={result}
        baseline={baseline}
        assetsById={ASSETS_BY_ID}
        projection={makeProjection()}
      />
    )
    await user.click(screen.getByRole("button", { name: /Other transfer counts/i }))

    // Footer sample-size sentence (5 completed races, 3 sprints).
    expect(screen.getByText(/based on 5 completed races, 3 sprints\./i)).toBeInTheDocument()

    // A bucket with at least one swap: expand it and confirm AssetMath shows a
    // preset label + the session split.
    const best = result.best
    if (best.transfers > 0) {
      const trigger = screen.getByText(
        `${best.transfers} transfer${best.transfers === 1 ? "" : "s"}`
      )
      await user.click(trigger)
      expect(screen.getAllByText(/Weighted recent:/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/n=5/).length).toBeGreaterThan(0)
    }
  })
})
