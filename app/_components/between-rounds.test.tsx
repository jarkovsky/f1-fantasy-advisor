import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { BetweenRounds } from "@/app/_components/between-rounds"
import type { AssetLite } from "@/lib/asset-lite"
import { installMatchMediaStub } from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Deterministic grid (mirrors team-picker.test.tsx). BetweenRounds is a pure
// prop-driven view — no store, no devNow seeding. We pass a roster + the actual
// last-race points and assert the honest scored-vs-projected comparison.
// ---------------------------------------------------------------------------

function driver(n: number, priceTenths: number): AssetLite {
  return {
    playerId: `d${n}`,
    kind: "driver",
    displayName: `Driver ${n}`,
    fullName: `Firstname Lastname${n}`,
    tla: `D0${n}`,
    priceTenths,
    prevPriceTenths: priceTenths,
    selectedPercent: 10 + n,
    captainSelectedPercent: n,
    constructorId: ["c1", "c2", "c3"][n % 3] ?? "c1",
    teamName: "Team",
    seasonPoints: 100 + n,
    headshotPath: null,
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
    selectedPercent: 5 + n,
    captainSelectedPercent: 0,
    constructorId: null,
    teamName: `Constructor ${n} Full`,
    seasonPoints: 200 + n,
    headshotPath: null,
  }
}

const ASSETS: AssetLite[] = [
  ...Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20)),
  constructor(1, 250),
  constructor(2, 200),
  constructor(3, 150),
]
const ASSETS_BY_ID: Record<string, AssetLite> = Object.fromEntries(
  ASSETS.map((a) => [a.playerId, a])
)

const ROSTER = ["d1", "d2", "d3", "d4", "d5", "c1", "c2"]
// Actual points per roster id → scored sum = 25+18+15+12+10+33+27 = 140.
const LAST_RACE_POINTS: Record<string, number | null> = {
  d1: 25,
  d2: 18,
  d3: 15,
  d4: 12,
  d5: 10,
  c1: 33,
  c2: 27,
}
const SCORED_SUM = 140

let uninstallMatchMedia: () => void

beforeEach(() => {
  uninstallMatchMedia = installMatchMediaStub()
})

afterEach(() => {
  cleanup()
  uninstallMatchMedia()
})

function renderView(props?: Partial<Parameters<typeof BetweenRounds>[0]>) {
  return render(
    <BetweenRounds
      lastCompleted={5}
      roster={ROSTER}
      assetsById={ASSETS_BY_ID}
      lastRacePoints={LAST_RACE_POINTS}
      savedProjection={{ totalPoints: 128.4, preset: "weighted-recent" }}
      {...props}
    />
  )
}

describe("BetweenRounds", () => {
  it("renders 'You scored X · we projected Y' with both numbers from lastRacePoints over the roster and the savedProjection", () => {
    renderView()

    expect(screen.getByText(/Results are in for race 5\./)).toBeInTheDocument()

    // The comparison line carries both numbers (scored sum and projected total).
    const comparison = screen.getByText(/You scored/)
    expect(comparison).toHaveTextContent(
      `You scored ${SCORED_SUM} · we projected 128.4`
    )
    // The signed delta (140 − 128.4 = +11.6) renders.
    expect(screen.getByText("+11.6")).toBeInTheDocument()
  })

  it("omits the comparison card when there is no savedProjection but still renders the headline", () => {
    renderView({ savedProjection: null })

    expect(screen.getByText(/Results are in for race 5\./)).toBeInTheDocument()
    expect(screen.queryByText(/You scored/)).not.toBeInTheDocument()
  })

  it("renders the 'Next race not published yet' line", () => {
    renderView()
    expect(
      screen.getByText(/Next race not published yet — check back soon\./)
    ).toBeInTheDocument()
  })
})
