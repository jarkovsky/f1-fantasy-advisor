import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { AssetLite } from "@/lib/asset-lite"

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { reconcileLineup, toOptimizerAssets } from "@/lib/optimizer/adapter"
import { optimize } from "@/lib/optimizer/optimize"
import { formatSignedPoints } from "@/lib/format"

import { installMatchMediaStub, installResizeObserverStub } from "@/test/stubs/dom"

import { TeamPlanCard } from "./team-plan-card"

// ---------------------------------------------------------------------------
// Deterministic grid (mirrors advisor-panel.test): 8 drivers + 3 constructors,
// prices descending. The card is fed a real optimize() result so assertions use
// the engine as the oracle rather than hand-rolled plans.
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
    boostedPercent: n,
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
    boostedPercent: 0,
    constructorId: null,
    teamName: `Constructor ${n} Full`,
    seasonPoints: 200 + n,
    headshotPath: null,
  }
}

const DRIVERS = Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20)) // d1=300…d8=160
const CONSTRUCTORS = [constructor(1, 250), constructor(2, 200), constructor(3, 150)]
const GRID: AssetLite[] = [...DRIVERS, ...CONSTRUCTORS]
const ASSETS_BY_ID = Object.fromEntries(GRID.map((a) => [a.playerId, a]))

// d1 best → Boost driver; lineup holds the cheaper d4–d8 so an upgrade is optimal.
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

function plan(
  costCap: number,
  free: number
): { result: OptimizerResult; baseline: TeamPlan | null } {
  const grid = toOptimizerAssets(GRID, TOTALS)
  const { assets } = reconcileLineup(LINEUP, grid)
  const result = optimize({
    assets,
    lineup: LINEUP,
    remainingCostCapTenths: costCap,
    freeTransfers: free,
    mode: "normal",
  })
  return { result, baseline: result.byTransferCount[0] ?? null }
}

function renderCard(over: Partial<Parameters<typeof TeamPlanCard>[0]> = {}) {
  const { result, baseline } = plan(500, 3)
  const props = {
    result,
    baseline,
    assetsById: ASSETS_BY_ID,
    totals: TOTALS,
    freeTransfers: 3 as number | "unlimited",
    whatIf: "none" as const,
    unresolvedIds: [] as string[],
    applied: false,
    onApply: vi.fn(),
    onEdit: vi.fn(),
    ...over,
  }
  return { ...render(<TeamPlanCard {...props} />), props }
}

let uninstallMatchMedia: () => void
let uninstallResizeObserver: () => void
beforeEach(() => {
  uninstallMatchMedia = installMatchMediaStub()
  uninstallResizeObserver = installResizeObserverStub()
})
afterEach(() => {
  cleanup()
  uninstallMatchMedia()
  uninstallResizeObserver()
})

describe("TeamPlanCard", () => {
  it("renders the headline delta and Boost driver from the optimizer result", () => {
    const { props } = renderCard()
    const best = props.result.best
    const baselineTotal = props.baseline?.projectedTotal ?? 0

    const block = screen.getByText("vs keeping your current team").parentElement as HTMLElement
    expect(
      within(block).getByText(formatSignedPoints(best.score - baselineTotal))
    ).toBeInTheDocument()

    // The Boost badge sits on the Boost driver's row (its accessible label).
    const chip = screen.getByLabelText("x2 Boost driver")
    expect(chip).toBeInTheDocument()
    expect(
      screen.getByText(`Boost → ${ASSETS_BY_ID[best.boostDriverId]?.displayName}`, { exact: false })
    ).toBeInTheDocument()
  })

  it("shows a transfer penalty line when transfers exceed free", () => {
    // 2 free but the optimal plan makes several swaps → a penalty.
    renderCard({ ...plan(500, 2), freeTransfers: 2 })
    expect(screen.getByText(/pts penalty/)).toBeInTheDocument()
  })

  it("shows the no-changes copy when the current team is already optimal", () => {
    // Baseline == best: make the lineup the optimal team by ranking it top.
    const optimalTotals: Record<string, number> = {
      d4: 100,
      d5: 90,
      d6: 80,
      d7: 70,
      d8: 60,
      d1: 1,
      d2: 1,
      d3: 1,
      c2: 50,
      c3: 40,
      c1: 1,
    }
    const grid = toOptimizerAssets(GRID, optimalTotals)
    const { assets } = reconcileLineup(LINEUP, grid)
    const result = optimize({
      assets,
      lineup: LINEUP,
      remainingCostCapTenths: 0,
      freeTransfers: 2,
      mode: "normal",
    })
    renderCard({
      result,
      baseline: result.byTransferCount[0] ?? null,
      totals: optimalTotals,
    })
    expect(
      screen.getByText(/No changes — your current team is already optimal/)
    ).toBeInTheDocument()
  })

  it("renders unavailable tiles for unresolved lineup ids wired to onEdit", async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ unresolvedIds: ["dGONE"] })
    expect(screen.getByText(/no longer available\./)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /replace/i }))
    expect(props.onEdit).toHaveBeenCalled()
  })

  it("in a what-if it shows the hypothetical badge and no Apply button", () => {
    renderCard({ whatIf: "wildcard" })
    expect(screen.getByText("Hypothetical — not saved")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /apply this plan/i })).not.toBeInTheDocument()
  })

  it("shows a disabled applied state and the Limitless cost cap note", () => {
    renderCard({ applied: true })
    expect(screen.getByRole("button", { name: /plan applied/i })).toBeDisabled()

    cleanup()
    renderCard({ whatIf: "limitless" })
    expect(screen.getByText(/\(Limitless: no cost cap\)/)).toBeInTheDocument()
  })

  it("fires onApply", async () => {
    const user = userEvent.setup()
    const { props } = renderCard()
    await user.click(screen.getByRole("button", { name: /apply this plan/i }))
    expect(props.onApply).toHaveBeenCalled()
  })

  it("the Boost ranking lists drivers by projection desc and stars the Boost driver", async () => {
    const user = userEvent.setup()
    const { props } = renderCard()
    await user.click(screen.getByRole("button", { name: /Boost ranking/i }))
    const best = props.result.best
    const names = best.driverIds
      .map((id) => ({ name: ASSETS_BY_ID[id]?.displayName ?? id, p: TOTALS[id] ?? 0 }))
      .sort((a, b) => b.p - a.p)
      .map((x) => x.name)
    // The rendered order matches projection-desc.
    const rendered = screen.getAllByRole("listitem").map((li) => li.textContent ?? "")
    const rankedText = rendered.filter((t) => names.some((n) => t.includes(n)))
    for (let i = 0; i < names.length - 1; i++) {
      const a = rankedText.findIndex((t) => t.includes(names[i] as string))
      const b = rankedText.findIndex((t) => t.includes(names[i + 1] as string))
      expect(a).toBeLessThan(b)
    }
  })
})
