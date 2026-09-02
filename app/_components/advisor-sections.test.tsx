import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdvisorPanel } from "@/app/_components/advisor-panel"
import type {
  AdvisorServerProps,
  ConcretePresetId,
} from "@/app/_components/advisor-types"
import type { AssetLite } from "@/lib/asset-lite"
import type { RaceWeekConstraints } from "@/lib/f1/schemas"
import type { AssetProjection, ProjectionResult } from "@/lib/projections"
import { teamStore } from "@/lib/store"
import { fixtureWeekends } from "@/test/fixtures"
import {
  installMatchMediaStub,
  installResizeObserverStub,
} from "@/test/stubs/dom"

// next/navigation mocked the same way advisor-panel.test.tsx does.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// --- Minimal seeding helpers (mirrors advisor-panel.test.tsx) ----------------
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
    constructorId: `c${((n - 1) % 3) + 1}`,
    teamName: `Team ${((n - 1) % 3) + 1}`,
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

const DRIVERS: AssetLite[] = Array.from({ length: 8 }, (_, i) =>
  driver(i + 1, 300 - i * 20)
)
const CONSTRUCTORS: AssetLite[] = [
  constructor(1, 250),
  constructor(2, 200),
  constructor(3, 150),
]
const GRID: AssetLite[] = [...DRIVERS, ...CONSTRUCTORS]

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

function makeProjection(presetId: ConcretePresetId): ProjectionResult {
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
      source: presetId,
      basis: { completedRaces: 5, completedSprints: 3 },
    }
  }
  return {
    byPlayerId,
    requestedPreset: presetId,
    effectivePreset: presetId,
    basis: { completedRaces: 5, completedSprints: 3 },
    coldStart: false,
    notes: [],
  }
}

function makeConstraints(): RaceWeekConstraints {
  return {
    raceNumber: 6,
    lastCompletedRace: 5,
    seasonEndRace: 22,
    budgetCapTenths: 1000,
    rolloverArmedRaces: [],
    subScenario: "TR_PRE",
    advisoryDeadlineRaw: "06/05/2026 00:00:00",
  }
}

function makeProps(): AdvisorServerProps {
  return {
    constraints: makeConstraints(),
    raceWeekends: fixtureWeekends(),
    nextRacePublished: false,
    live: false,
    assets: GRID,
    projectionsByPreset: {
      "weighted-recent": makeProjection("weighted-recent"),
      "form-5": makeProjection("form-5"),
      "season-average": makeProjection("season-average"),
      "equal-ppm": makeProjection("equal-ppm"),
    },
    lastRacePoints: {},
    meta: { source: "live", asOf: "2026-06-05" },
  }
}

const BEFORE_LOCK = "2026-06-05T12:00:00Z" // race 6 OPEN
const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

let uninstallMatchMedia: () => void
let uninstallResizeObserver: () => void

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  uninstallMatchMedia = installMatchMediaStub()
  uninstallResizeObserver = installResizeObserverStub()
})

afterEach(() => {
  cleanup()
  uninstallMatchMedia()
  uninstallResizeObserver()
  localStorage.clear()
  teamStore.__resetForTests()
})

describe("OPEN — mobile section tabs", () => {
  it("switching to Team hides (but keeps mounted) the plan card; aria-pressed flips", async () => {
    localStorage.setItem("f1:devNow", BEFORE_LOCK)
    teamStore.subscribe(() => {})
    teamStore.setTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("Recommended plan", undefined, { timeout: 15_000 })

    // Both sections exist; advice is the default-active one.
    const advice = document.getElementById("advice-section") as HTMLElement
    const team = document.getElementById("team-section") as HTMLElement
    expect(advice).not.toBeNull()
    expect(team).not.toBeNull()
    expect(advice.className).not.toContain("hidden")
    expect(team.className).toContain("hidden")

    const adviceTab = screen.getByRole("button", { name: "Advice" })
    const teamTab = screen.getByRole("button", { name: "Team" })
    expect(adviceTab).toHaveAttribute("aria-pressed", "true")
    expect(teamTab).toHaveAttribute("aria-pressed", "false")

    const user = userEvent.setup()
    await user.click(teamTab)

    // The plan card stays mounted (display-toggled only), not unmounted.
    expect(screen.queryByText("Recommended plan")).not.toBeNull()

    // Team section loses the hidden class; advice gains it.
    expect(team.className).not.toContain("hidden")
    expect(advice.className).toContain("hidden")

    // aria-pressed flipped.
    expect(teamTab).toHaveAttribute("aria-pressed", "true")
    expect(adviceTab).toHaveAttribute("aria-pressed", "false")

    // Sanity: the team section actually holds the team panel.
    expect(
      within(team).getByRole("heading", { name: "Your team" })
    ).toBeInTheDocument()
  })
})
