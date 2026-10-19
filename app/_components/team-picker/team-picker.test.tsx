import type { AssetLite } from "@/lib/asset-lite"

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { teamStore } from "@/lib/team/store"

import { installMatchMediaStub } from "@/test/stubs/dom"

import { TeamPicker } from "./team-picker"

// ---------------------------------------------------------------------------
// Deterministic set: the shared fixtures carry only 4 assets — too few to fill
// a 5-driver / 2-constructor team. We hand-roll 8 drivers + 3 constructors with
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
    boostedPercent: n,
    constructorId: "c1",
    teamName: "Team One",
    seasonPoints: 100 + n,
    headshotPath: null,
    logo: null,
    active: true,
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
    logo: null,
    active: true,
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

/** Every row after the first table's header row. */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1)
}

/** The checkbox for a given asset, addressed by its full-name aria-label. */
function checkboxFor(fullName: string | RegExp): HTMLElement {
  return screen.getByRole("checkbox", {
    name: new RegExp(`Select ${typeof fullName === "string" ? fullName : fullName.source}`),
  })
}

/** Click the checkbox of each fixture id, in order. */
async function pick(user: ReturnType<typeof userEvent.setup>, ids: string[]): Promise<void> {
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
    await pick(user, ["d1", "d2", "d3", "d4", "d5"])

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
    expect(screen.getByRole("heading", { name: "Drivers 1/5" })).toBeInTheDocument()
    await user.click(checkboxFor("Firstname Lastname1"))
    expect(screen.getByRole("heading", { name: "Drivers 0/5" })).toBeInTheDocument()
  })

  it("ARIA live region exists at first render and updates after a selection", async () => {
    const user = userEvent.setup()
    renderPicker()
    // The container's polite live region (a role=status) carries the team-state
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

  it("a line above the disabled CTA says what blocks it; enabled exactly at 5+2 with Remaining Cost Cap entered", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cta = screen.getByRole("button", { name: "Save team & get advice" })
    expect(cta).toBeDisabled()
    expect(cta).toHaveAccessibleDescription(
      "Pick 5 more drivers and 2 more constructors to continue"
    )

    await pick(user, ["d1", "d2", "d3", "d4", "c1", "c2"])
    expect(cta).toHaveAccessibleDescription("Pick 1 more driver to continue")
    expect(cta).toBeDisabled()

    await pick(user, ["d5"])
    // Team complete but no Remaining Cost Cap yet → still blocked.
    expect(cta).toHaveAccessibleDescription("Set your Remaining Cost Cap to continue")
    expect(cta).toBeDisabled()

    const costCap = screen.getByLabelText(/remaining cost cap/i)
    await user.clear(costCap)
    await user.type(costCap, "5")
    // The label never changes; once nothing blocks it the reason line goes.
    expect(cta).toHaveAccessibleName("Save team & get advice")
    expect(cta).toBeEnabled()
    expect(screen.queryByText(/to continue$/)).not.toBeInTheDocument()
  })

  it("over-initial-cost-cap team does not block once Remaining Cost Cap entered (no warn copy)", async () => {
    const user = userEvent.setup()
    renderPicker()
    // 5 priciest drivers (1300) + 2 ctors (450) = 1750 tenths; Remaining Cost Cap 5 → 1800.
    await pick(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])
    const costCap = screen.getByLabelText(/remaining cost cap/i)
    await user.type(costCap, "5")

    expect(screen.getByRole("button", { name: /save team & get advice/i })).toBeEnabled()
    // No over-cost-cap warning is shown.
    expect(screen.queryByText(/Heads up/)).not.toBeInTheDocument()
  })

  it("summary lists each pick under its count, and removing one frees the slot", async () => {
    const user = userEvent.setup()
    renderPicker()
    const drivers = screen.getByRole("region", { name: "Drivers 0/5" })
    expect(screen.getByRole("heading", { name: "Constructors 0/2" })).toBeInTheDocument()
    expect(within(drivers).getAllByRole("button", { name: "Pick a driver" })).toHaveLength(5)

    await user.click(checkboxFor("Firstname Lastname1"))
    expect(screen.getByRole("heading", { name: "Drivers 1/5" })).toBeInTheDocument()
    expect(within(drivers).getByText("Driver 1")).toBeInTheDocument()
    expect(within(drivers).getAllByRole("button", { name: "Pick a driver" })).toHaveLength(4)
    // The summary never totals what the team costs.
    expect(screen.queryByText(/Spent/)).not.toBeInTheDocument()

    await user.click(within(drivers).getByRole("button", { name: "Remove Driver 1" }))
    expect(screen.getByRole("heading", { name: "Drivers 0/5" })).toBeInTheDocument()
    expect(checkboxFor("Firstname Lastname1")).not.toBeChecked()
  })

  it("an empty slot jumps to its table and focuses the first pickable row", async () => {
    const user = userEvent.setup()
    const original = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    // jsdom has no scrollIntoView.
    Element.prototype.scrollIntoView = scrollIntoView
    onTestFinished(() => {
      Element.prototype.scrollIntoView = original
    })
    renderPicker()
    await user.click(checkboxFor("Constructor 1 Full"))

    const constructors = screen.getByRole("region", { name: "Constructors 1/2" })
    await user.click(within(constructors).getByRole("button", { name: "Pick a constructor" }))
    expect(scrollIntoView).toHaveBeenCalled()
    // c1 is already picked, so focus lands on the next unchecked constructor.
    expect(document.activeElement).toBe(checkboxFor("Constructor 2 Full"))
  })

  it("keyboard: Tab reaches a row checkbox and Space toggles it", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cb = checkboxFor("Firstname Lastname1")
    cb.focus()
    expect(cb).toHaveFocus()
    await user.keyboard(" ")
    expect(cb).toBeChecked()
    expect(screen.getByRole("heading", { name: "Drivers 1/5" })).toBeInTheDocument()
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
    expect(screen.getByRole("heading", { name: "Constructors 1/2" })).toBeInTheDocument()
    // Clear the search — d1 is visible again and still checked.
    await user.clear(search)
    expect(checkboxFor("Firstname Lastname1")).toBeChecked()
    expect(screen.getByRole("heading", { name: "Drivers 1/5" })).toBeInTheDocument()
  })

  it("first-run flow writes the store with sorted lineup, Remaining Cost Cap, transfers, raceNumber", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    renderPicker({ onDone })

    await pick(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])

    const costCap = screen.getByLabelText(/remaining cost cap/i)
    await user.clear(costCap)
    await user.type(costCap, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(screen.getByRole("button", { name: /save team & get advice/i }))

    const snap = teamStore.getSnapshot()
    expect(snap.lineup).toEqual(["d1", "d2", "d3", "d4", "d5", "c1", "c2"])
    expect(snap.remainingCostCapTenths).toBe(25)
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
    // Remaining Cost Cap input prefilled to 2.5.
    const costCap = screen.getByLabelText(/remaining cost cap/i) as HTMLInputElement
    expect(costCap.value).toBe("2.5")

    // Cancel: no store write, onDone called.
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(teamStore.getSnapshot().remainingCostCapTenths).toBe(25) // unchanged
  })

  it("never lists inactive drivers, and a saved team holding one opens a pick short", () => {
    // d9 is the feed's stale leftover entry (IsActive "0").
    const stale = { ...driver(9, 151), active: false }
    teamStore.subscribe(() => {})
    teamStore.setTeam(["d1", "d2", "d3", "d4", "d9", "c1", "c2"], 25, 3, 6)

    render(<TeamPicker assets={[...ASSETS, stale]} raceNumber={6} mode="edit" />)

    expect(screen.queryByRole("checkbox", { name: /Lastname9/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Drivers (8)" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Drivers 4/5" })).toBeInTheDocument()
    expect(screen.getByText("Pick 1 more driver to continue")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("Start over dialog resets the store to its default state and calls onDone", async () => {
    const user = userEvent.setup()
    teamStore.subscribe(() => {})
    teamStore.setTeam(["d1", "d2", "d3", "d4", "d5", "c1", "c2"], 25, 3, 6)

    const onDone = vi.fn()
    renderPicker({ mode: "edit", onDone })

    await user.click(screen.getByRole("button", { name: /^start over$/i }))
    // Dialog open — confirm the destructive action.
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /^start over$/i }))

    expect(teamStore.getSnapshot().lineup).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("Unlimited segmented option sets freeTransfers 'unlimited' on save", async () => {
    const user = userEvent.setup()
    renderPicker()
    await pick(user, ["d1", "d2", "d3", "d4", "d5", "c1", "c2"])

    const costCap = screen.getByLabelText(/remaining cost cap/i)
    await user.clear(costCap)
    await user.type(costCap, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(screen.getByRole("radio", { name: "Unlimited" }))
    await user.click(screen.getByRole("button", { name: /save team & get advice/i }))

    expect(teamStore.getSnapshot().freeTransfers).toBe("unlimited")
  })
})
