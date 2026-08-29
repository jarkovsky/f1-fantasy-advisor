import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { RolloverForm } from "@/app/_components/rollover-form"
import type { AssetLite } from "@/lib/asset-lite"
import { teamStore } from "@/lib/store"
import { installMatchMediaStub } from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Deterministic grid (mirrors team-picker.test.tsx): 8 drivers + 3 constructors
// with realistic tenths and a current/prev price split so the per-asset price
// Delta in step 1 is exact. The rollover form is prop-driven, but its Confirm
// path writes through confirmRollover, so we wire onConfirm to the REAL store
// and assert the resulting snapshot.
// ---------------------------------------------------------------------------

function driver(
  n: number,
  priceTenths: number,
  prevPriceTenths: number
): AssetLite {
  return {
    playerId: `d${n}`,
    kind: "driver",
    displayName: `Driver ${n}`,
    fullName: `Firstname Lastname${n}`,
    tla: `D0${n}`,
    priceTenths,
    prevPriceTenths,
    selectedPercent: 10 + n,
    captainSelectedPercent: n,
    constructorId: ["c1", "c2", "c3"][n % 3] ?? "c1",
    teamName: "Team",
    seasonPoints: 100 + n,
    headshotPath: null,
  }
}

function constructor(
  n: number,
  priceTenths: number,
  prevPriceTenths: number
): AssetLite {
  return {
    playerId: `c${n}`,
    kind: "constructor",
    displayName: `Constructor ${n}`,
    fullName: `Constructor ${n} Full`,
    tla: `C0${n}`,
    priceTenths,
    prevPriceTenths,
    selectedPercent: 5 + n,
    captainSelectedPercent: 0,
    constructorId: null,
    teamName: `Constructor ${n} Full`,
    seasonPoints: 200 + n,
    headshotPath: null,
  }
}

// d1 rose +0.3 (303 vs 300), d2 fell −0.2 (278 vs 280), rest flat.
const DRIVERS: AssetLite[] = [
  driver(1, 303, 300),
  driver(2, 278, 280),
  driver(3, 260, 260),
  driver(4, 240, 240),
  driver(5, 220, 220),
  driver(6, 200, 200),
  driver(7, 180, 180),
  driver(8, 160, 160),
]
const CONSTRUCTORS: AssetLite[] = [
  constructor(1, 250, 250),
  constructor(2, 200, 200),
  constructor(3, 150, 150),
]
const ASSETS: AssetLite[] = [...DRIVERS, ...CONSTRUCTORS]
const ASSETS_BY_ID: Record<string, AssetLite> = Object.fromEntries(
  ASSETS.map((a) => [a.playerId, a])
)

const SAVED_ROSTER = ["d1", "d2", "d3", "d4", "d5", "c1", "c2"]

let uninstallMatchMedia: () => void

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  // Seed a saved team so confirmRollover spreads a sensible base snapshot.
  teamStore.subscribe(() => {})
  teamStore.setTeam(SAVED_ROSTER, 25, 2, 5)
  uninstallMatchMedia = installMatchMediaStub()
})

afterEach(() => {
  cleanup()
  uninstallMatchMedia()
  localStorage.clear()
  teamStore.__resetForTests()
})

function renderForm(props?: Partial<Parameters<typeof RolloverForm>[0]>) {
  return render(
    <RolloverForm
      from={5}
      to={6}
      assets={ASSETS}
      assetsById={ASSETS_BY_ID}
      team={teamStore.getSnapshot()}
      budgetCapTenths={1000}
      onConfirm={teamStore.confirmRollover}
      {...props}
    />
  )
}

describe("RolloverForm", () => {
  it("renders the new-race-week banner and step 1 with the saved roster at new prices and per-asset price deltas", () => {
    renderForm()

    // Banner naming both races.
    expect(
      screen.getByText("New race week — confirm your team.")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Race 5 is done; race 6 is open\./)
    ).toBeInTheDocument()

    // Every saved asset that resolves renders its display name at the new price.
    for (const id of SAVED_ROSTER) {
      const a = ASSETS_BY_ID[id] as AssetLite
      expect(screen.getByText(a.displayName)).toBeInTheDocument()
    }

    // d1's new price ($30.3M) and its +0.3 rise both render.
    expect(screen.getByText("$30.3M")).toBeInTheDocument()
    expect(screen.getByText("+0.3")).toBeInTheDocument()
    // d2 fell −0.2 (U+2212 minus glyph).
    expect(screen.getByText("−0.2")).toBeInTheDocument()
  })

  it("renders an unavailable tile for a saved id missing from the current feed", () => {
    const team = {
      ...teamStore.getSnapshot(),
      roster: ["dGONE", "d2", "d3", "d4", "d5", "c1", "c2"],
    }
    renderForm({ team })

    expect(screen.getByText(/no longer available\./)).toBeInTheDocument()
    expect(
      screen.getByText(/Not in the current race feed\./)
    ).toBeInTheDocument()
  })

  it("kept this exact team → confirm bumps stored raceNumber to `to` with the chosen free-transfer count", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(
      screen.getByRole("radio", { name: /I kept this exact team/i })
    )
    // Bank is prefilled from the team, so step 3 is reachable immediately.
    await user.click(
      screen.getByRole("radio", { name: /Standard \(2 free\)/i })
    )
    await user.click(
      screen.getByRole("button", { name: /confirm and continue/i })
    )

    const snap = teamStore.getSnapshot()
    expect(snap.raceNumber).toBe(6)
    expect(snap.roster).toEqual(SAVED_ROSTER)
    expect(snap.freeTransfers).toBe(2)
    expect(snap.activeChip).toBe("none")
  })

  it("banked-a-transfer radio confirms with freeTransfers 3", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(
      screen.getByRole("radio", { name: /I kept this exact team/i })
    )
    await user.click(
      screen.getByRole("radio", { name: /I banked a transfer \(3 free\)/i })
    )
    await user.click(
      screen.getByRole("button", { name: /confirm and continue/i })
    )

    expect(teamStore.getSnapshot().freeTransfers).toBe(3)
  })

  it("played-a-chip reveals the chip sub-choice; Limitless → freeTransfers 'unlimited' + activeChip 'limitless'", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(
      screen.getByRole("radio", { name: /I kept this exact team/i })
    )
    // The chip sub-radiogroup is hidden until "I played a chip" is selected.
    expect(
      screen.queryByRole("radiogroup", { name: /which chip\?/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: /I played a chip/i }))
    const chipGroup = screen.getByRole("radiogroup", { name: /which chip\?/i })
    expect(chipGroup).toBeInTheDocument()

    await user.click(
      within(chipGroup).getByRole("radio", { name: /Limitless/i })
    )
    await user.click(
      screen.getByRole("button", { name: /confirm and continue/i })
    )

    const snap = teamStore.getSnapshot()
    expect(snap.freeTransfers).toBe("unlimited")
    expect(snap.activeChip).toBe("limitless")
  })

  it("exposes an sr-only polite status summary region before confirm", () => {
    renderForm()
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status.className).toContain("sr-only")
    // Incomplete on first render.
    expect(status).toHaveTextContent("Complete every step to continue.")
  })
})
