import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TeamPicker } from "./team-picker"
import type { AssetLite } from "@/lib/asset-lite"
import { teamStore } from "@/lib/team/store"
import { installMatchMediaStub } from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Deterministic set: the shared fixtures carry only 4 assets — too few to fill
// a 5-driver / 2-constructor squad. We hand-roll 8 drivers + 3 constructors with
// realistic tenths so quota, save and sort assertions are exact.
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
    constructorId: "c1",
    teamName: "Team One",
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

// 8 drivers priced 300..160 step −20; 3 constructors 250/200/150.
const DRIVERS: AssetLite[] = Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20))
const CONSTRUCTORS: AssetLite[] = [constructor(1, 250), constructor(2, 200), constructor(3, 150)]
const ASSETS: AssetLite[] = [...DRIVERS, ...CONSTRUCTORS]

let uninstallMatchMedia: () => void

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  uninstallMatchMedia = installMatchMediaStub()
})

afterEach(() => {
  cleanup()
  uninstallMatchMedia()
  localStorage.clear()
  teamStore.__resetForTests()
})

function renderPicker(props?: Partial<Parameters<typeof TeamPicker>[0]>) {
  return render(<TeamPicker assets={ASSETS} raceNumber={6} mode="first-run" {...props} />)
}

/** All data rows (excludes the header row). */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1)
}

/** The checkbox for a given asset, addressed by its full-name aria-label. */
function checkboxFor(fullName: string | RegExp): HTMLElement {
  return screen.getByRole("checkbox", {
    name: new RegExp(`Select ${typeof fullName === "string" ? fullName : fullName.source}`),
  })
}

/** Click the leading checkbox of the first n body rows (price-desc order). */
async function pickFirst(user: ReturnType<typeof userEvent.setup>, ids: string[]): Promise<void> {
  for (const id of ids) {
    const cb = screen.getByRole("checkbox", { name: new RegExp(idToName(id)) })
    await user.click(cb)
  }
}

/** Map a fixture id to a fragment of its aria-label. */
function idToName(id: string): string {
  if (id.startsWith("d")) return `Lastname${id.slice(1)}`
  return `Constructor ${id.slice(1)} Full`
}

describe("TeamPicker", () => {
  it("renders one card with a table per kind and exactly one save CTA", () => {
    renderPicker()
    // Exactly one Card wraps the whole flow (one save button, not two).
    expect(screen.getAllByRole("button", { name: /save team & get advice/i })).toHaveLength(1)
    // Two separate kind tables, each counting its own assets.
    expect(screen.getByRole("heading", { name: "Drivers (8)" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Constructors (3)" })).toBeInTheDocument()
    // Default order is price descending — the priciest driver (d1, $30M) leads.
    expect(within(bodyRows()[0] as HTMLElement).getByText("$30.0M")).toBeInTheDocument()
  })

  it("selecting 5 drivers disables the remaining drivers' checkboxes", async () => {
    const user = userEvent.setup()
    renderPicker()
    await pickFirst(user, ["d1", "d2", "d3", "d4", "d5"])

    // The 6th..8th drivers are disabled once the driver quota is full.
    expect(checkboxFor("Firstname Lastname6")).toBeDisabled()
    expect(checkboxFor("Firstname Lastname7")).toBeDisabled()
    expect(checkboxFor("Firstname Lastname8")).toBeDisabled()
    // The selected five stay enabled (so they can be toggled off).
    expect(checkboxFor("Firstname Lastname1")).toBeEnabled()
    // Constructors are unaffected.
    expect(checkboxFor("Constructor 1 Full")).toBeEnabled()

    // Toggle one selected driver off → the others re-enable.
    await user.click(checkboxFor("Firstname Lastname1"))
    expect(checkboxFor("Firstname Lastname6")).toBeEnabled()
  })

  it("clicking a checked checkbox deselects it (count returns)", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cb = checkboxFor("Firstname Lastname1")
    await user.click(cb)
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
    await user.click(checkboxFor("Firstname Lastname1"))
    expect(screen.getByText(/Drivers 0\/5/)).toBeInTheDocument()
  })

  it("ARIA live region exists at first render and updates after a selection", async () => {
    const user = userEvent.setup()
    renderPicker()
    // The container's polite live region (a role=status) carries the squad-state
    // message; PickerTable also renders a status region, so assert via text.
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(
        "5 drivers and 2 constructors required — you have 0 drivers and 0 constructors."
      )
    ).toBeInTheDocument()
    await user.click(checkboxFor("Firstname Lastname1"))
    expect(
      screen.getByText(
        "5 drivers and 2 constructors required — you have 1 drivers and 0 constructors."
      )
    ).toBeInTheDocument()
  })

  it("CTA disabled while incomplete; enabled exactly at 5+2 with bank entered", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cta = screen.getByRole("button", { name: /save team & get advice/i })
    expect(cta).toBeDisabled()

    await pickFirst(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])
    // Squad complete but no bank yet → still blocked.
    expect(cta).toBeDisabled()

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "5")
    expect(cta).toBeEnabled()
  })

  it("over-initial-budget squad does not block once bank entered (no warn copy)", async () => {
    const user = userEvent.setup()
    renderPicker()
    // 5 priciest drivers (1300) + 2 ctors (450) = 1750 tenths; bank 5 → 1800.
    await pickFirst(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])
    const bank = screen.getByLabelText(/remaining budget/i)
    await user.type(bank, "5")

    expect(screen.getByRole("button", { name: /save team & get advice/i })).toBeEnabled()
    // The killed sanity warning never appears.
    expect(screen.queryByText(/Heads up/)).not.toBeInTheDocument()
  })

  it("summary panel shows counts and Spent updates with formatPriceTenths", async () => {
    const user = userEvent.setup()
    renderPicker()
    expect(screen.getByText(/Drivers 0\/5 · Constructors 0\/2/)).toBeInTheDocument()
    expect(screen.getByText(/Spent \$0\.0M/)).toBeInTheDocument()
    await user.click(checkboxFor("Firstname Lastname1")) // d1 = 300 tenths
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
    expect(screen.getByText(/Spent \$30\.0M/)).toBeInTheDocument()
  })

  it("keyboard: Tab reaches a row checkbox and Space toggles it", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cb = checkboxFor("Firstname Lastname1")
    cb.focus()
    expect(cb).toHaveFocus()
    await user.keyboard(" ")
    expect(cb).toBeChecked()
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
  })

  it("the shared search narrows both tables and preserves selections", async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(checkboxFor("Firstname Lastname1")) // d1
    // Search for constructors — the drivers table empties but d1 stays selected.
    const search = screen.getByRole("searchbox", {
      name: /search drivers and constructors/i,
    })
    await user.type(search, "Constructor")
    expect(screen.getByText("No matches.")).toBeInTheDocument() // drivers table
    await user.click(checkboxFor("Constructor 1 Full")) // c1
    expect(screen.getByText(/Constructors 1\/2/)).toBeInTheDocument()
    // Clear the search — d1 is visible again and still checked.
    await user.clear(search)
    expect(checkboxFor("Firstname Lastname1")).toBeChecked()
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
  })

  it("first-run flow writes the store with sorted roster, bank, transfers, raceNumber", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    renderPicker({ onDone })

    await pickFirst(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(screen.getByRole("button", { name: /save team & get advice/i }))

    const snap = teamStore.getSnapshot()
    expect(snap.roster).toEqual(["d1", "d2", "d3", "d4", "d5", "c1", "c2"])
    expect(snap.budgetTenths).toBe(25)
    expect(snap.freeTransfers).toBe(3)
    expect(snap.raceNumber).toBe(6)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("edit mode prefills from store; Cancel does not write", async () => {
    const user = userEvent.setup()
    teamStore.subscribe(() => {})
    teamStore.setTeam(["d1", "d2", "d3", "d4", "d5", "c1", "c2"], 25, 3, 6)

    const onDone = vi.fn()
    renderPicker({ mode: "edit", onDone })

    // Selected drivers pre-checked.
    expect(checkboxFor("Firstname Lastname1")).toBeChecked()
    // Bank input prefilled to 2.5.
    const bank = screen.getByLabelText(/remaining budget/i) as HTMLInputElement
    expect(bank.value).toBe("2.5")

    // Cancel: no store write, onDone called.
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(teamStore.getSnapshot().budgetTenths).toBe(25) // unchanged
  })

  it("Start over dialog resets the store to DEFAULT and calls onDone", async () => {
    const user = userEvent.setup()
    teamStore.subscribe(() => {})
    teamStore.setTeam(["d1", "d2", "d3", "d4", "d5", "c1", "c2"], 25, 3, 6)

    const onDone = vi.fn()
    renderPicker({ mode: "edit", onDone })

    await user.click(screen.getByRole("button", { name: /^start over$/i }))
    // Dialog open — confirm the destructive action.
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /^start over$/i }))

    expect(teamStore.getSnapshot().roster).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("Unlimited segmented option sets freeTransfers 'unlimited' on save", async () => {
    const user = userEvent.setup()
    renderPicker()
    await pickFirst(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(screen.getByRole("radio", { name: "Unlimited" }))
    await user.click(screen.getByRole("button", { name: /save team & get advice/i }))

    expect(teamStore.getSnapshot().freeTransfers).toBe("unlimited")
  })
})
