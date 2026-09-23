import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PickerTable } from "@/app/_components/picker-table"
import type { AssetLite } from "@/lib/asset-lite"

// ---------------------------------------------------------------------------
// PickerTable is dumb: selection + quota arrive as props, toggles report back.
// We hand-roll a small deterministic set so search / filter / sort assertions
// are exact (real parsed fixtures carry only 4 assets — too few).
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

afterEach(cleanup)

function renderTable(props?: Partial<Parameters<typeof PickerTable>[0]>) {
  return render(
    <PickerTable
      assets={ASSETS}
      selected={new Set<string>()}
      driversFull={false}
      constructorsFull={false}
      onToggle={vi.fn()}
      {...props}
    />
  )
}

/** Data rows (excludes the header row). */
function bodyRows(): HTMLElement[] {
  const all = screen.getAllByRole("row")
  return all.slice(1)
}

/** The leading-cell TLA text for each body row, in order. */
function rowTlas(): (string | undefined)[] {
  return bodyRows().map(
    (r) => within(r).getByText(/^[DC]0\d$/).textContent ?? undefined
  )
}

describe("PickerTable", () => {
  it("renders all assets with one row each and filter chips show counts", () => {
    renderTable()
    expect(bodyRows()).toHaveLength(11)
    expect(screen.getByRole("button", { name: "All (11)" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Drivers (8)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Constructors (3)" })
    ).toBeInTheDocument()
  })

  it("defaults to price-descending order across drivers and constructors", () => {
    renderTable()
    // d1..d8 (300..160) then c-prices interleave by price: 300,280,...,160 for
    // drivers and 250,200,150 for constructors — merged descending.
    const prices = bodyRows().map(
      (r) => within(r).getByText(/^\$\d/).textContent
    )
    expect(prices).toEqual([
      "$30.0M", // d1 300
      "$28.0M", // d2 280
      "$26.0M", // d3 260
      "$25.0M", // c1 250
      "$24.0M", // d4 240
      "$22.0M", // d5 220
      "$20.0M", // d6 200 (d6 before c2: stable sort keeps source order on ties)
      "$20.0M", // c2 200
      "$18.0M", // d7 180
      "$16.0M", // d8 160
      "$15.0M", // c3 150
    ])
  })

  it("search filters rows by TLA / name, case-insensitive", async () => {
    const user = userEvent.setup()
    renderTable()
    const search = screen.getByRole("searchbox", {
      name: /search drivers and constructors/i,
    })
    await user.type(search, "d03")
    expect(bodyRows()).toHaveLength(1)
    expect(rowTlas()).toEqual(["D03"])

    await user.clear(search)
    await user.type(search, "constructor 2 full")
    expect(bodyRows()).toHaveLength(1)
    expect(rowTlas()).toEqual(["C02"])
  })

  it("Constructors filter shows only the constructor rows", async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByRole("button", { name: /^constructors/i }))
    expect(bodyRows()).toHaveLength(3)
    expect(rowTlas()).toEqual(["C01", "C02", "C03"])
  })

  it("sort cycle on Pts updates aria-sort and row order (desc→asc→default)", async () => {
    const user = userEvent.setup()
    renderTable()
    const ptsHeader = () => screen.getByRole("columnheader", { name: /^Pts/ })
    const ptsButton = () =>
      within(ptsHeader()).getByRole("button", { name: /^Pts/ })

    // First click → descending. Constructors carry the highest seasonPoints.
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "descending")
    expect(rowTlas()[0]).toBe("C03") // 203 highest

    // Second click → ascending.
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "ascending")
    expect(rowTlas()[0]).toBe("D01") // 101 lowest

    // Third click → default (price desc); Pts header no longer sorted.
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "none")
    expect(rowTlas()[0]).toBe("D01") // d1 = 300 most expensive
  })

  it("checkbox reflects selection and disables unselected at quota", () => {
    renderTable({
      selected: new Set(["d1"]),
      driversFull: true,
    })
    // d1 is selected → enabled checkbox, checked.
    const d1 = screen.getByRole("checkbox", { name: /Firstname Lastname1/ })
    expect(d1).toBeChecked()
    expect(d1).toBeEnabled()
    // d2 (a driver) is unselected with the driver quota full → disabled.
    const d2 = screen.getByRole("checkbox", { name: /Firstname Lastname2/ })
    expect(d2).not.toBeChecked()
    expect(d2).toBeDisabled()
    // Constructors are unaffected (their quota is not full).
    const c1 = screen.getByRole("checkbox", { name: /Constructor 1 Full/ })
    expect(c1).toBeEnabled()
  })

  it("clicking a checkbox calls onToggle once with the asset id", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderTable({ onToggle })
    await user.click(
      screen.getByRole("checkbox", { name: /Firstname Lastname1/ })
    )
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith("d1")
  })

  it("Space on a focused checkbox toggles it", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderTable({ onToggle })
    const cb = screen.getByRole("checkbox", { name: /Firstname Lastname1/ })
    cb.focus()
    await user.keyboard(" ")
    expect(onToggle).toHaveBeenCalledWith("d1")
  })
})
