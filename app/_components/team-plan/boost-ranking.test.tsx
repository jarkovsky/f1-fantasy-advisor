import type { TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { AssetLite } from "@/lib/asset-lite"

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import userEvent from "@testing-library/user-event"

import { BoostRanking } from "./boost-ranking"

afterEach(cleanup)

function driver(n: number): AssetLite {
  return {
    playerId: `d${n}`,
    kind: "driver",
    displayName: `Driver ${n}`,
    fullName: `Firstname Lastname${n}`,
    tla: `D0${n}`,
    priceTenths: 100,
    prevPriceTenths: 100,
    selectedPercent: 10,
    boostedPercent: 1,
    constructorId: "c1",
    teamName: "Team 1",
    seasonPoints: 100,
    headshotPath: null,
    logo: null,
  }
}

const ASSETS_BY_ID = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`d${n}`, driver(n)]))
const TOTALS: Record<string, number> = { d1: 12, d2: 40, d3: 25, d4: 8, d5: 31 }
const PLAN: TeamPlan = {
  driverIds: ["d1", "d2", "d3", "d4", "d5"],
  constructorIds: ["c1", "c2"],
  boostDriverId: "d2",
  costTenths: 900,
  projectedTotal: 156,
  score: 156,
  transfers: 0,
  penaltyPoints: 0,
  remainingCostCapTenths: 100,
}

describe("BoostRanking", () => {
  it("lists the plan's drivers by projection, badging the Boost driver on top", async () => {
    const user = userEvent.setup()
    render(<BoostRanking plan={PLAN} assetsById={ASSETS_BY_ID} totals={TOTALS} />)

    const trigger = screen.getByRole("button", { name: /Boost ranking/i })
    await user.click(trigger)
    const items = within(trigger.closest("[data-slot=collapsible]") as HTMLElement)
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")

    expect(items.map((t) => t.match(/Driver \d/)?.[0])).toEqual([
      "Driver 2",
      "Driver 5",
      "Driver 3",
      "Driver 1",
      "Driver 4",
    ])
    expect(items[0]).toContain("x2 Boost")
    expect(items.slice(1).join("")).not.toContain("x2 Boost")
  })
})
