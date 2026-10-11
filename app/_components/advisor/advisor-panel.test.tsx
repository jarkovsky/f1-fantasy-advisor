import type { AssetProjection, ProjectionResult } from "@/lib/projections/types/projection"
import type { ConcretePresetId } from "@/lib/projections/types/presets"
import type { AdvisorServerProps } from "@/lib/advisor/types/contract"
import type { RaceWeekConstraints } from "@/lib/f1/schemas"
import type { AssetLite } from "@/lib/asset-lite"

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { reconcileRoster, toOptimizerAssets } from "@/lib/optimizer/adapter"
import { optimize } from "@/lib/optimizer/optimize"
import { formatSignedPoints } from "@/lib/format"
import { teamStore } from "@/lib/team/store"

import { AdvisorPanel } from "@/app/_components/advisor/advisor-panel"

import { installMatchMediaStub, installResizeObserverStub } from "@/test/stubs/dom"
import { fixtureWeekends } from "@/test/fixtures"

// ---------------------------------------------------------------------------
// next/navigation is mocked at module level. `searchParamsMock` is mutable so a
// test can drive the URL-derived preset (test 12) before rendering; `replaceSpy`
// captures router.replace for URL-sync assertions.
// ---------------------------------------------------------------------------
let searchParamsMock = new URLSearchParams()
const replaceSpy = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy }),
  useSearchParams: () => searchParamsMock,
}))

// Wrap optimize() in a counting passthrough: the real implementation still runs
// (the oracle tests depend on it), but the call count lets the H2 regression
// assert the optimizer does not re-run on incidental re-renders.
vi.mock("@/lib/optimizer/optimize", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/optimizer/optimize")>()
  return { ...actual, optimize: vi.fn(actual.optimize) }
})

// ---------------------------------------------------------------------------
// Hand-rolled deterministic grid: the real fixtures carry only 4 assets — too
// few for the optimizer's 5-driver / 2-constructor floor. 8 drivers + 3
// constructors, AssetLite-complete, prices descending so quota / budget math is
// exact and reproducible.
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
    constructorId: `c${((n - 1) % 3) + 1}`, // round-robin c1..c3
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

const DRIVERS: AssetLite[] = Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20)) // d1=300 … d8=160
const CONSTRUCTORS: AssetLite[] = [constructor(1, 250), constructor(2, 200), constructor(3, 150)]
const GRID: AssetLite[] = [...DRIVERS, ...CONSTRUCTORS]

// ---------------------------------------------------------------------------
// Projection helper: builds a ProjectionResult from a flat totals map, with a
// quali/race session split that sums to the total (40% / 60%). Distinct totals
// per preset make a preset switch observable.
// ---------------------------------------------------------------------------
function makeProjection(
  totals: Record<string, number>,
  presetId: ConcretePresetId,
  opts: { coldStart?: boolean; effectivePreset?: ConcretePresetId } = {}
): ProjectionResult {
  const byPlayerId: Record<string, AssetProjection> = {}
  for (const a of GRID) {
    const t = totals[a.playerId] ?? 0
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
    effectivePreset: opts.effectivePreset ?? presetId,
    basis: { completedRaces: 5, completedSprints: 3 },
    coldStart: opts.coldStart ?? false,
    notes: [],
  }
}

// Per-preset totals — deliberately distinct so a switch is observable. The
// drivers descend by index (d1 best) for weighted-recent; season-average shifts
// the favourite to d2.
const WEIGHTED: Record<string, number> = {
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
const SEASON_AVG: Record<string, number> = {
  d1: 55,
  d2: 95,
  d3: 75,
  d4: 65,
  d5: 50,
  d6: 45,
  d7: 35,
  d8: 25,
  c1: 40,
  c2: 30,
  c3: 20,
}
const FORM: Record<string, number> = { ...WEIGHTED, d1: 88 }
const EQUAL_PPM: Record<string, number> = { ...WEIGHTED, d2: 70 }

function projectionsByPreset(
  over: Partial<Record<ConcretePresetId, ProjectionResult>> = {}
): Record<ConcretePresetId, ProjectionResult> {
  return {
    "weighted-recent": makeProjection(WEIGHTED, "weighted-recent"),
    "form-5": makeProjection(FORM, "form-5"),
    "season-average": makeProjection(SEASON_AVG, "season-average"),
    "equal-ppm": makeProjection(EQUAL_PPM, "equal-ppm"),
    ...over,
  }
}

// ---------------------------------------------------------------------------
// Constraints + props builders.
// ---------------------------------------------------------------------------
function makeConstraints(over: Partial<RaceWeekConstraints> = {}): RaceWeekConstraints {
  return {
    raceNumber: 6,
    lastCompletedRace: 5,
    seasonEndRace: 22,
    budgetCapTenths: 1000,
    rolloverArmedRaces: [],
    subScenario: "TR_PRE",
    advisoryDeadlineRaw: "06/05/2026 00:00:00",
    ...over,
  }
}

function makeProps(over: Partial<AdvisorServerProps> = {}): AdvisorServerProps {
  return {
    constraints: makeConstraints(),
    raceWeekends: fixtureWeekends(),
    nextRacePublished: false,
    live: false,
    assets: GRID,
    projectionsByPreset: projectionsByPreset(),
    lastRacePoints: {},
    meta: { source: "live", asOf: "2026-06-05" },
    ...over,
  }
}

// Real Monaco instants (mirrors lib/f1/raceweek.test.ts).
const BEFORE_LOCK = "2026-06-05T12:00:00Z" // race 6 OPEN
const INSIDE_LOCK = "2026-06-06T20:00:00Z" // race 6 LOCKED window

function seedDevNow(iso: string): void {
  localStorage.setItem("f1:devNow", iso)
}

/**
 * Seed the store with a saved team. Subscribe first so the module hydrates (and
 * stops re-reading localStorage), then write — mirrors team-picker.test.tsx.
 */
function seedTeam(
  roster: string[],
  budgetTenths: number,
  freeTransfers: 2 | 3 | "unlimited",
  raceNumber: number
): void {
  teamStore.subscribe(() => {})
  teamStore.setTeam(roster, budgetTenths, freeTransfers, raceNumber)
}

let uninstallMatchMedia: () => void
let uninstallResizeObserver: () => void

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  searchParamsMock = new URLSearchParams()
  replaceSpy.mockClear()
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

// ---------------------------------------------------------------------------
// 1. FIRST_VISIT — empty store → the team picker, no recommendation.
// ---------------------------------------------------------------------------
describe("FIRST_VISIT", () => {
  it("renders the team picker and no recommendation card", async () => {
    seedDevNow(BEFORE_LOCK)
    render(<AdvisorPanel {...makeProps()} />)

    expect(await screen.findByRole("heading", { name: "Drivers (8)" })).toBeInTheDocument()
    expect(screen.queryByText("vs keeping your current team")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 2. OPEN — the command center renders.
// ---------------------------------------------------------------------------
describe("OPEN", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("renders the race header and the recommended plan card", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    expect(await screen.findByRole("heading", { name: "Monaco Grand Prix" })).toBeInTheDocument()
    expect(
      await screen.findByText("vs keeping your current team", undefined, {
        timeout: 15_000,
      })
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 3. ORACLE EQUALITY — the rendered plan agrees with optimize() run inline on
//    the same (weighted-recent default preset) inputs.
// ---------------------------------------------------------------------------
describe("OPEN — oracle equality", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]
  const BANK = 500
  const FREE = 3

  function expected() {
    const grid = toOptimizerAssets(GRID, WEIGHTED)
    const { assets } = reconcileRoster(ROSTER, grid)
    return optimize({
      assets,
      roster: ROSTER,
      budgetTenths: BANK,
      freeTransfers: FREE,
      mode: "normal",
    })
  }

  it("plan transfers, DRS pick, and headline gain match the optimizer", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, BANK, FREE, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })
    const exp = expected()

    // Transfer chip.
    const tLabel = `${exp.best.transfers} transfer${exp.best.transfers === 1 ? "" : "s"}`
    expect(screen.getByText(tLabel)).toBeInTheDocument()

    // DRS Boost pick = the optimizer's captain.
    const captainName = GRID.find((a) => a.playerId === exp.best.captainId)?.displayName ?? "?"
    const drsLine = screen.getByText(
      (_, el) =>
        el?.tagName === "P" && Boolean(el.textContent?.startsWith(`DRS Boost → ${captainName} `))
    )
    expect(drsLine).toBeInTheDocument()

    // Headline gain = best.score − byTransferCount[0].projectedTotal, via
    // formatSignedPoints. Scope to the "vs keeping your current team" block.
    const baseline = exp.byTransferCount[0]?.projectedTotal ?? 0
    const gainText = formatSignedPoints(exp.best.score - baseline)
    const block = screen.getByText("vs keeping your current team").parentElement as HTMLElement
    expect(within(block).getByText(gainText)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// H2 REGRESSION — on custom-blend, an incidental re-render with identical props
// (what the 30s clock tick triggers) must NOT re-run the optimizer. The
// custom-blend projection builds a fresh map each call; a useMemo keeps it
// referentially stable so `totals` — and the optimizer effect keyed on it —
// stay put. Without the memo, every render re-ran the ~1.45M-combo search.
// ---------------------------------------------------------------------------
describe("OPEN — custom-blend optimizer stability", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("does not re-run the optimizer on a same-props re-render", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    searchParamsMock = new URLSearchParams("preset=custom-blend")
    const props = makeProps()
    const { rerender } = render(<AdvisorPanel {...props} />)

    await screen.findByText("vs keeping your current team", undefined, { timeout: 15_000 })
    const before = vi.mocked(optimize).mock.calls.length

    // A same-props re-render is exactly what the 30s setNow tick triggers.
    rerender(<AdvisorPanel {...props} />)
    // Give the optimizer effect (dynamic import cached, transition-wrapped) ample
    // real time to fire if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(vi.mocked(optimize).mock.calls.length).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// 4. Penalty accounting — three big non-roster drivers make a 3-transfer plan
//    optimal at 2 free transfers → a −10 penalty surfaces in both views.
// ---------------------------------------------------------------------------
describe("OPEN — transfer penalty", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c1", "c2"]
  // d1,d2,d3 (non-roster) are huge; everything else tiny. Optimal squad keeps
  // d4,d5 + c1,c2, swaps in d1,d2,d3 = 3 transfers (1 beyond the 2 free).
  const TOTALS: Record<string, number> = {
    d1: 1000,
    d2: 1000,
    d3: 1000,
    d4: 5,
    d5: 4,
    d6: 3,
    d7: 2,
    d8: 1,
    c1: 9,
    c2: 8,
    c3: 1,
  }

  it("shows the −10 penalty line and the bucket penalty note", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 600, 2, 6)
    render(
      <AdvisorPanel
        {...makeProps({
          projectionsByPreset: projectionsByPreset({
            "weighted-recent": makeProjection(TOTALS, "weighted-recent"),
          }),
        })}
      />
    )

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    // Confirm the optimizer truly chose 3 transfers (guards the fixture).
    const grid = toOptimizerAssets(GRID, TOTALS)
    const { assets } = reconcileRoster(ROSTER, grid)
    const exp = optimize({
      assets,
      roster: ROSTER,
      budgetTenths: 600,
      freeTransfers: 2,
      mode: "normal",
    })
    expect(exp.best.transfers).toBe(3)

    // Merged card penalty line.
    expect(screen.getByText(/−10 pts penalty/)).toBeInTheDocument()

    // Alternatives: open the disclosure, then the 3-transfer bucket carries the
    // "(−10 penalty)" note.
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /other transfer counts/i }))
    expect(await screen.findByText(/\(−10 penalty\)/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 5. DRS Boost ranking — collapsed by default; expanding shows five driver rows
//    sorted by projection desc, with the optimizer captain starred on top.
// ---------------------------------------------------------------------------
describe("OPEN — DRS Boost ranking", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("orders drivers by projection and stars the optimizer captain on top", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    const grid = toOptimizerAssets(GRID, WEIGHTED)
    const { assets } = reconcileRoster(ROSTER, grid)
    const exp = optimize({
      assets,
      roster: ROSTER,
      budgetTenths: 500,
      freeTransfers: 3,
      mode: "normal",
    })

    // The ranking lives in a default-collapsed Collapsible — open it first.
    const heading = screen.getByRole("heading", { name: "DRS Boost ranking" })
    const trigger = heading.closest("button") as HTMLElement
    const user = userEvent.setup()
    await user.click(trigger)

    // Scope to the ranking's own list (the card also holds the squad rows).
    const content = trigger
      .closest("[data-slot=collapsible]")
      ?.querySelector("[data-slot=collapsible-content]") as HTMLElement
    const rows = within(content).getAllByRole("listitem")

    // The plan's five drivers, sorted by projection desc.
    const sorted = [...exp.best.driverIds].sort((a, b) => (WEIGHTED[b] ?? 0) - (WEIGHTED[a] ?? 0))
    const expectedNames = sorted.map((id) => GRID.find((a) => a.playerId === id)?.displayName)
    const rowNames = rows.map((r) => r.textContent?.replace("★", "").replace(/\+.*$/, "").trim())
    expect(rowNames).toEqual(expectedNames)

    // Top row = the captain.
    const captainName = GRID.find((a) => a.playerId === exp.best.captainId)?.displayName
    expect(rows[0]?.textContent).toContain(captainName)
  })
})

// ---------------------------------------------------------------------------
// 6. What-if wildcard — toggling it removes the penalty, marks it hypothetical,
//    and removes the Apply CTA.
// ---------------------------------------------------------------------------
describe("OPEN — wildcard what-if", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c1", "c2"]

  it("flips to the no-penalty copy and hides the Apply button", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 600, 2, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })
    // Pre-toggle: an Apply button exists.
    expect(screen.getByRole("button", { name: /apply this plan/i })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("switch", { name: "Wildcard (what-if)" }))

    expect(await screen.findByText("Hypothetical — not saved")).toBeInTheDocument()
    expect(screen.getByText(/Within your free transfers — no penalty\./)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /apply this plan/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 7. What-if limitless — budget ignored; the explicit copy appears and the
//    post-transfer bank can go negative.
// ---------------------------------------------------------------------------
describe("OPEN — limitless what-if", () => {
  // Cheap roster, tiny bank: the raw-max squad (priciest, best-projected drivers)
  // exceeds the purse, so limitless drives budgetLeft negative.
  const ROSTER = ["d6", "d7", "d8", "d4", "d5", "c2", "c3"]

  it("shows the Limitless-ignores-budget copy with a negative bank", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 20, 2, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole("switch", { name: "Limitless (what-if)" }))

    expect(await screen.findByText(/Limitless ignores budget/)).toBeInTheDocument()

    // The optimizer ignores budget → the best squad is the priciest drivers, so
    // the post-transfer bank is negative (rendered with a leading minus).
    const grid = toOptimizerAssets(GRID, WEIGHTED)
    const { assets } = reconcileRoster(ROSTER, grid)
    const exp = optimize({
      assets,
      roster: ROSTER,
      budgetTenths: 20,
      freeTransfers: "unlimited",
      mode: "limitless",
    })
    expect(exp.best.budgetLeftTenths).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// 8. ROLLOVER beats OPEN — seeded raceNumber 5 → reconciliation banner, no plan;
//    completing the form opens the command center.
// ---------------------------------------------------------------------------
describe("ROLLOVER", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("renders the reconcile banner instead of the plan, then opens on confirm", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 5) // entered for race 5; pointer is on 6
    render(<AdvisorPanel {...makeProps()} />)

    expect(await screen.findByText("New race week — confirm your team.")).toBeInTheDocument()
    expect(screen.queryByText("vs keeping your current team")).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("radio", { name: /I kept this exact team/i }))
    await user.click(screen.getByRole("radio", { name: /Standard \(2 free\)/i }))
    await user.click(screen.getByRole("button", { name: /confirm and continue/i }))

    // raceNumber bumped to 6 → OPEN → the command center appears.
    expect(
      await screen.findByText("vs keeping your current team", undefined, {
        timeout: 15_000,
      })
    ).toBeInTheDocument()
    expect(teamStore.getSnapshot().raceNumber).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// 9. LOCKED — inside the lock window: read-only, no Apply / transfer CTA.
// ---------------------------------------------------------------------------
describe("LOCKED", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("renders the locked read-only view with no apply action", async () => {
    seedDevNow(INSIDE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    expect(await screen.findByText(/Team locked for the Monaco Grand Prix\./)).toBeInTheDocument()
    // Read-only roster is visible …
    expect(screen.getByText("Driver 4")).toBeInTheDocument()
    // … but there is no apply / recommendation CTA.
    expect(screen.queryByRole("button", { name: /apply this plan/i })).not.toBeInTheDocument()
    expect(screen.queryByText("vs keeping your current team")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 10. SEASON_ENDED — final round scored, no next race.
// ---------------------------------------------------------------------------
describe("SEASON_ENDED", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("renders the season wrap copy", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(
      <AdvisorPanel
        {...makeProps({
          constraints: makeConstraints({
            lastCompletedRace: 22,
            seasonEndRace: 22,
          }),
        })}
      />
    )

    expect(await screen.findByText("That's a wrap on the 2026 season.")).toBeInTheDocument()
    expect(screen.queryByText("vs keeping your current team")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 11. Unresolvable saved id — a roster id absent from the grid still optimizes
//     (placeholder), surfacing both the "no longer available" tile and a plan.
// ---------------------------------------------------------------------------
describe("OPEN — unresolvable saved id", () => {
  const ROSTER = ["ghost1", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("shows the unavailable tile and still produces a recommendation", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    expect(
      await screen.findByText("vs keeping your current team", undefined, {
        timeout: 15_000,
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText(/no longer available\./).length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// 12. Preset switch re-projects — ?preset=season-average drives the merged
//     card's roster rows to the season-average numbers. d4 stays in the
//     recommended squad under season-average, so it renders as a kept row.
// ---------------------------------------------------------------------------
describe("OPEN — preset switch", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("uses the season-average projection when the URL selects it", async () => {
    searchParamsMock = new URLSearchParams("preset=season-average")
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    // The merged "Your team" card renders each kept asset's projected total.
    // d4's season-average total (65.0) differs from its weighted-recent (70.0).
    const heading = screen.getByRole("heading", { name: "Your team" })
    const card = heading.closest("[data-slot=card]") as HTMLElement
    const d4Row = within(card).getByText("Driver 4").closest("li") as HTMLElement
    expect(within(d4Row).getByText("65.0")).toBeInTheDocument()
    expect(within(d4Row).queryByText("70.0")).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 13. Cold start — every concrete preset is coldStart with effective equal-ppm:
//     the controls show the cold-start note and grey the history presets.
// ---------------------------------------------------------------------------
describe("OPEN — cold start", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  function coldStartPresets(): Record<ConcretePresetId, ProjectionResult> {
    const cold = (id: ConcretePresetId): ProjectionResult =>
      makeProjection(EQUAL_PPM, id, {
        coldStart: true,
        effectivePreset: "equal-ppm",
      })
    return {
      "weighted-recent": cold("weighted-recent"),
      "form-5": cold("form-5"),
      "season-average": cold("season-average"),
      "equal-ppm": makeProjection(EQUAL_PPM, "equal-ppm"),
    }
  }

  it("renders the cold-start note and disables the history presets", async () => {
    // Radix Select needs these jsdom-missing primitives to open.
    Element.prototype.scrollIntoView = vi.fn()
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()

    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps({ projectionsByPreset: coldStartPresets() })} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    // Cold-start note (always rendered when coldStart).
    expect(screen.getByText(/Race 1 — no history yet/)).toBeInTheDocument()

    // Open the projection-model Select → history presets are aria-disabled.
    const user = userEvent.setup()
    await user.click(screen.getByRole("combobox", { name: "Projection model" }))
    const weighted = await screen.findByRole("option", {
      name: /Weighted recent/,
    })
    expect(weighted).toHaveAttribute("aria-disabled", "true")
    // Equal PPM (the locked fallback) stays enabled.
    const equalPpm = screen.getByRole("option", { name: /Equal PPM/ })
    expect(equalPpm).not.toHaveAttribute("aria-disabled", "true")
  })
})

// ---------------------------------------------------------------------------
// 14. Merged card rows — kept slots render plain (no strikethrough); swapped
//     slots strike the out-asset and bold the in-asset; the DRS chip lands on
//     the recommended captain's row.
// ---------------------------------------------------------------------------
describe("OPEN — merged card rows", () => {
  const ROSTER = ["d4", "d5", "d6", "d7", "d8", "c2", "c3"]

  it("distinguishes kept vs swapped rows and chips the captain", async () => {
    seedDevNow(BEFORE_LOCK)
    seedTeam(ROSTER, 500, 3, 6)
    render(<AdvisorPanel {...makeProps()} />)

    await screen.findByText("vs keeping your current team", undefined, {
      timeout: 15_000,
    })

    const grid = toOptimizerAssets(GRID, WEIGHTED)
    const { assets } = reconcileRoster(ROSTER, grid)
    const exp = optimize({
      assets,
      roster: ROSTER,
      budgetTenths: 500,
      freeTransfers: 3,
      mode: "normal",
    })

    const heading = screen.getByRole("heading", { name: "Your team" })
    const card = heading.closest("[data-slot=card]") as HTMLElement

    const nameOf = (id: string) => GRID.find((a) => a.playerId === id)?.displayName ?? id

    // A kept driver (in both the roster and the recommended plan) renders
    // without a strikethrough. d4 and d5 survive under weighted-recent.
    const keptId = exp.best.driverIds.find((id) => ROSTER.includes(id) && id !== exp.best.captainId)
    expect(keptId).toBeDefined()
    const keptName = within(card).getByText(nameOf(keptId as string))
    expect(keptName.className).not.toContain("line-through")

    // A swapped slot: the out-asset is struck through, the in-asset is bold.
    // Pick a non-captain in-asset so its name span carries no nested DRS chip.
    const inId = exp.best.driverIds.find((id) => !ROSTER.includes(id) && id !== exp.best.captainId)
    const outId = ROSTER.filter((id) => id.startsWith("d") && !exp.best.driverIds.includes(id))[0]
    expect(inId).toBeDefined()
    expect(outId).toBeDefined()
    const outName = within(card).getByText(nameOf(outId as string))
    expect(outName.className).toContain("line-through")
    const inName = within(card).getByText(nameOf(inId as string))
    expect(inName.className).toContain("font-medium")

    // The DRS chip sits on the recommended captain's row (walk up from the
    // chip; the name span nests the chip, so match by the chip's own label).
    const chip = within(card).getByLabelText("DRS Boost captain")
    const captainRow = chip.closest("li") as HTMLElement
    expect(captainRow.textContent).toContain(nameOf(exp.best.captainId))
  })
})
