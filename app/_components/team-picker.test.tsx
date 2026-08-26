import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TeamPicker } from "@/app/_components/team-picker"
import type { AssetLite } from "@/lib/asset-lite"
import { teamStore } from "@/lib/store"
import { installMatchMediaStub } from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Deterministic grid: the shared fixtures carry only 4 assets — too few to fill
// a 5-driver / 2-constructor squad. We hand-roll 8 drivers + 3 constructors with
// realistic tenths so quota, over-budget and sort assertions are exact.
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
const DRIVERS: AssetLite[] = Array.from({ length: 8 }, (_, i) =>
  driver(i + 1, 300 - i * 20)
)
const CONSTRUCTORS: AssetLite[] = [
  constructor(1, 250),
  constructor(2, 200),
  constructor(3, 150),
]
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
  return render(
    <TeamPicker
      assets={ASSETS}
      budgetCapTenths={1000}
      raceNumber={6}
      mode="first-run"
      {...props}
    />
  )
}

/** Options inside the currently-active tab panel (the visible listbox). */
function visibleOptions(): HTMLElement[] {
  const listbox = screen.getByRole("listbox")
  return within(listbox).getAllByRole("option")
}

/** Switch to the constructors tab. */
async function openConstructors(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /constructors/i }))
}

/** Pick the first n options in the visible listbox. */
async function pickFirst(
  user: ReturnType<typeof userEvent.setup>,
  n: number
): Promise<void> {
  const options = visibleOptions()
  for (let i = 0; i < n; i++) {
    const opt = options[i]
    if (opt) await user.click(opt)
  }
}

describe("TeamPicker", () => {
  it("renders tabs with counts from props and price-descending card order", () => {
    renderPicker()
    expect(screen.getByRole("tab", { name: "Drivers (8)" })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: "Constructors (3)" })
    ).toBeInTheDocument()

    // Drivers tab is the default — TLAs render in price-descending order. The
    // monogram avatar and the TLA both carry the TLA text, so target the
    // font-mono semibold TLA span (last occurrence inside the option label).
    const tlas = visibleOptions().map((o) => {
      const matches = within(o).getAllByText(/^D0\d$/)
      return matches[matches.length - 1]?.textContent
    })
    expect(tlas).toEqual([
      "D01",
      "D02",
      "D03",
      "D04",
      "D05",
      "D06",
      "D07",
      "D08",
    ])
  })

  it("selecting 5 drivers disables the rest; toggling one off re-enables", async () => {
    const user = userEvent.setup()
    renderPicker()
    await pickFirst(user, 5)

    let options = visibleOptions()
    // The 6th..8th (unselected) are aria-disabled once the quota is full.
    expect(options[5]).toHaveAttribute("aria-disabled", "true")
    expect(options[6]).toHaveAttribute("aria-disabled", "true")
    expect(options[7]).toHaveAttribute("aria-disabled", "true")
    // The selected five stay enabled.
    expect(options[0]).not.toHaveAttribute("aria-disabled")

    // Toggle the first selected off → the others re-enable.
    await user.click(options[0] as HTMLElement)
    options = visibleOptions()
    expect(options[5]).not.toHaveAttribute("aria-disabled")
  })

  it("clicking a selected card deselects it (no duplicate, count returns)", async () => {
    const user = userEvent.setup()
    renderPicker()
    const first = visibleOptions()[0] as HTMLElement
    await user.click(first)
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
    await user.click(visibleOptions()[0] as HTMLElement)
    expect(screen.getByText(/Drivers 0\/5/)).toBeInTheDocument()
  })

  it("ARIA live region exists at first render and updates after a selection", async () => {
    const user = userEvent.setup()
    renderPicker()
    const status = screen.getByRole("status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent(
      "5 drivers and 2 constructors required — you have 0 drivers and 0 constructors."
    )
    await user.click(visibleOptions()[0] as HTMLElement)
    expect(status).toHaveTextContent(
      "5 drivers and 2 constructors required — you have 1 drivers and 0 constructors."
    )
  })

  it("CTA disabled while incomplete; enabled exactly at 5+2 with bank entered", async () => {
    const user = userEvent.setup()
    renderPicker()
    const cta = screen.getByRole("button", { name: /save team & get advice/i })
    expect(cta).toBeDisabled()

    await pickFirst(user, 5)
    await openConstructors(user)
    await pickFirst(user, 2)
    // Squad complete but no bank yet → still blocked.
    expect(cta).toBeDisabled()

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "5")
    expect(cta).toBeEnabled()
  })

  it("over-initial-budget squad does not block once bank entered; warn is non-blocking", async () => {
    const user = userEvent.setup()
    renderPicker()
    // 5 most expensive drivers = 300+280+260+240+220 = 1300; +2 ctors 250+200 = 1750 tenths.
    await pickFirst(user, 5)
    await openConstructors(user)
    await pickFirst(user, 2)
    const bank = screen.getByLabelText(/remaining budget/i)
    await user.type(bank, "5") // value 1750 + 50 = 1800 tenths, well over 1300.

    const cta = screen.getByRole("button", { name: /save team & get advice/i })
    expect(cta).toBeEnabled()
    // The warn copy appears in BOTH the visible pill and the sr-only live region.
    const warnings = screen.getAllByText(
      /Heads up — team value plus budget is \$180\.0M/
    )
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    // At least one is the visible (non-sr-only) text-warn paragraph.
    expect(warnings.some((el) => el.className.includes("text-warn"))).toBe(true)
  })

  it("sanity warn absent when value+bank within 900..1300 tenths", async () => {
    const user = userEvent.setup()
    // The default fixture's cheapest complete squad already exceeds 1300 tenths,
    // so use a tailored cheap set: 5 drivers @100 (500) + 2 ctors @150 (300) =
    // 800 value; bank $15M → 150 tenths → 950 total, inside [900,1300].
    const cheapDrivers = Array.from({ length: 5 }, (_, i) => driver(i + 1, 100))
    const cheapConstructors = [constructor(1, 150), constructor(2, 150)]
    render(
      <TeamPicker
        assets={[...cheapDrivers, ...cheapConstructors]}
        budgetCapTenths={1000}
        raceNumber={6}
        mode="first-run"
      />
    )
    await pickFirst(user, 5)
    await openConstructors(user)
    await pickFirst(user, 2)
    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "15")

    // value 800 + bank 150 = 950 tenths → no sanity warn.
    expect(screen.queryByText(/Heads up/)).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /save team & get advice/i })
    ).toBeEnabled()
  })

  it("sticky summary shows counts and Spent updates with formatPriceTenths", async () => {
    const user = userEvent.setup()
    renderPicker()
    expect(
      screen.getByText(/Drivers 0\/5 · Constructors 0\/2/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Spent \$0\.0M/)).toBeInTheDocument()
    await user.click(visibleOptions()[0] as HTMLElement) // d1 = 300 tenths
    expect(screen.getByText(/Drivers 1\/5/)).toBeInTheDocument()
    expect(screen.getByText(/Spent \$30\.0M/)).toBeInTheDocument()
  })

  it("roving tabindex: one option tabbable; arrows move focus; Enter toggles; focus doesn't select", async () => {
    const user = userEvent.setup()
    renderPicker()
    let options = visibleOptions()
    // Exactly one option has tabIndex 0 (the first).
    const tabbable = options.filter((o) => o.getAttribute("tabindex") === "0")
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toBe(options[0])

    options[0]?.focus()
    await user.keyboard("{ArrowRight}")
    options = visibleOptions()
    expect(document.activeElement).toBe(options[1])
    expect(options[1]).toHaveAttribute("tabindex", "0")
    expect(options[0]).toHaveAttribute("tabindex", "-1")
    // Arrow focus did NOT select.
    expect(options[1]).toHaveAttribute("aria-selected", "false")

    // Home jumps to first, End to last.
    await user.keyboard("{Home}")
    expect(document.activeElement).toBe(visibleOptions()[0])
    await user.keyboard("{End}")
    options = visibleOptions()
    expect(document.activeElement).toBe(options[options.length - 1])

    // Enter toggles the focused option.
    await user.keyboard("{Enter}")
    expect(visibleOptions()[7]).toHaveAttribute("aria-selected", "true")
  })

  it("tab switch preserves selections in both tabs", async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(visibleOptions()[0] as HTMLElement) // d1
    await openConstructors(user)
    await user.click(visibleOptions()[0] as HTMLElement) // c1 (sorted desc → 250)
    expect(visibleOptions()[0]).toHaveAttribute("aria-selected", "true")
    // Back to drivers — d1 still selected.
    await user.click(screen.getByRole("tab", { name: /drivers/i }))
    expect(visibleOptions()[0]).toHaveAttribute("aria-selected", "true")
  })

  it("first-run flow writes the store with sorted roster, bank, transfers, raceNumber", async () => {
    const user = userEvent.setup()
    const onDone = viFn()
    renderPicker({ onDone })

    await pickFirst(user, 5) // d1..d5
    await openConstructors(user)
    await pickFirst(user, 2) // c1, c2 (desc)

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(
      screen.getByRole("button", { name: /save team & get advice/i })
    )

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

    const onDone = viFn()
    renderPicker({ mode: "edit", onDone })

    // Selected drivers pre-checked.
    expect(visibleOptions()[0]).toHaveAttribute("aria-selected", "true")
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

    const onDone = viFn()
    renderPicker({ mode: "edit", onDone })

    await user.click(screen.getByRole("button", { name: /^start over$/i }))
    // Dialog open — confirm the destructive action.
    const dialog = screen.getByRole("dialog")
    await user.click(
      within(dialog).getByRole("button", { name: /^start over$/i })
    )

    expect(teamStore.getSnapshot().roster).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("Unlimited segmented option sets freeTransfers 'unlimited' on save", async () => {
    const user = userEvent.setup()
    renderPicker()
    await pickFirst(user, 5)
    await openConstructors(user)
    await pickFirst(user, 2)

    const bank = screen.getByLabelText(/remaining budget/i)
    await user.clear(bank)
    await user.type(bank, "2.5")
    await user.click(screen.getByRole("radio", { name: "3" }))
    await user.click(screen.getByRole("radio", { name: "Unlimited" }))
    await user.click(
      screen.getByRole("button", { name: /save team & get advice/i })
    )

    expect(teamStore.getSnapshot().freeTransfers).toBe("unlimited")
  })
})

function viFn() {
  return vi.fn()
}
