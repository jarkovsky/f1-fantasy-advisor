import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { ConcretePresetId } from "@/lib/projections/types/presets"
import type { AssetLite } from "@/lib/asset-lite"

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { LockedView } from "@/app/_components/advisor/locked-view"

import { installMatchMediaStub } from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Deterministic grid (mirrors team-picker.test.tsx). LockedView is read-only:
// it sums the stored roster's projections directly (no optimizer). We feed a
// hand-rolled ProjectionResult so the projected total and DRS Boost pick are
// exact, and assert no transfer/apply CTA exists.
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

// Per-roster projection totals: d1 is the clear top driver (the DRS pick).
// Σ = 20+15+12+10+8+30+25 = 120; DRS bonus = projOf(d1) * (2-1) = 20.
// Projected = 120 + 20 = 140.0 pts; DRS Boost = Driver 1.
const TOTALS: Record<string, number> = {
  d1: 20,
  d2: 15,
  d3: 12,
  d4: 10,
  d5: 8,
  c1: 30,
  c2: 25,
}

const PRESET: ConcretePresetId = "weighted-recent"

function makeProjection(totalsByPlayerId: Record<string, number>): ProjectionResult {
  const byPlayerId: ProjectionResult["byPlayerId"] = {}
  for (const [playerId, total] of Object.entries(totalsByPlayerId)) {
    byPlayerId[playerId] = {
      playerId,
      kind: playerId.startsWith("c") ? "constructor" : "driver",
      totalPoints: total,
      perSession: [
        { session: "Qualifying", expected: total * 0.4, basisRaces: 5 },
        { session: "Race", expected: total * 0.6, basisRaces: 5 },
      ],
      source: PRESET,
      basis: { completedRaces: 5, completedSprints: 3 },
    }
  }
  return {
    byPlayerId,
    requestedPreset: PRESET,
    effectivePreset: PRESET,
    basis: { completedRaces: 5, completedSprints: 3 },
    coldStart: false,
    notes: [],
  }
}

let uninstallMatchMedia: () => void

beforeEach(() => {
  uninstallMatchMedia = installMatchMediaStub()
})

afterEach(() => {
  cleanup()
  uninstallMatchMedia()
})

function renderView(props?: Partial<Parameters<typeof LockedView>[0]>) {
  return render(
    <LockedView
      gpName="Monaco Grand Prix"
      live={false}
      roster={ROSTER}
      assetsById={ASSETS_BY_ID}
      projection={makeProjection(TOTALS)}
      nextLockAtMs={null}
      {...props}
    />
  )
}

describe("LockedView", () => {
  it("renders the 'Team locked for the {gpName}' banner", () => {
    renderView()
    expect(screen.getByText(/Team locked for the Monaco Grand Prix\./)).toBeInTheDocument()
  })

  it("shows the live badge with a pulsing dot when live", () => {
    const { container } = renderView({ live: true })

    const badge = screen.getByText(/Race weekend in progress/)
    expect(badge).toBeInTheDocument()
    // The pulsing dot is a motion-safe animate-pulse element inside the badge.
    const dot = container.querySelector(".motion-safe\\:animate-pulse")
    expect(dot).not.toBeNull()
  })

  it("renders the projected score and DRS pick from the stored roster's projection (no optimizer)", () => {
    renderView()
    // Σ totals 120 + captain bonus 20 (d1) = 140.0; DRS Boost = Driver 1.
    expect(screen.getByText(/Projected 140\.0 pts · DRS Boost Driver 1/)).toBeInTheDocument()
  })

  it("renders no transfer / apply CTA anywhere", () => {
    renderView()
    expect(screen.queryByRole("button", { name: /transfer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /save team/i })).not.toBeInTheDocument()
    // Read-only view: no actionable buttons at all.
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })
})
