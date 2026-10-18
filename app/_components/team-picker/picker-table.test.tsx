import type { AssetLite } from "@/lib/asset-lite"

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { PickerTable } from "./picker-table"

// ---------------------------------------------------------------------------
// PickerTable is dumb and per-kind: the container splits drivers from
// constructors, owns selection + quota + the shared search box, and passes
// everything down. We hand-roll a small deterministic set so search / sort
// assertions are exact (real parsed fixtures carry only 4 assets — too few).
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

// 8 drivers priced 300..160 step −20; 3 constructors 250/200/150.
const DRIVERS: AssetLite[] = Array.from({ length: 8 }, (_, i) => driver(i + 1, 300 - i * 20))
const CONSTRUCTORS: AssetLite[] = [constructor(1, 250), constructor(2, 200), constructor(3, 150)]

afterEach(cleanup)

function renderTable(props?: Partial<Parameters<typeof PickerTable>[0]>) {
  return render(
    <PickerTable
      heading="Drivers"
      assets={DRIVERS}
      selected={new Set<string>()}
      quotaFull={false}
      query=""
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
  return bodyRows().map((r) => within(r).getByText(/^[DC]0\d$/).textContent ?? undefined)
}

describe("PickerTable", () => {
  it("renders one row per asset of its kind, with the heading count", () => {
    renderTable()
    expect(bodyRows()).toHaveLength(8)
    expect(screen.getByRole("heading", { name: "Drivers (8)" })).toBeInTheDocument()
  })

  it("a constructors table renders only the constructor rows", () => {
    renderTable({ heading: "Constructors", assets: CONSTRUCTORS })
    expect(screen.getByRole("heading", { name: "Constructors (3)" })).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(3)
    expect(rowTlas()).toEqual(["C01", "C02", "C03"])
  })

  it("defaults to price-descending order", () => {
    renderTable()
    const prices = bodyRows().map((r) => within(r).getByText(/^\$\d/).textContent)
    expect(prices).toEqual([
      "$30.0M",
      "$28.0M",
      "$26.0M",
      "$24.0M",
      "$22.0M",
      "$20.0M",
      "$18.0M",
      "$16.0M",
    ])
  })

  it("the query prop filters rows by TLA / name, case-insensitive; no match → empty state", () => {
    const { rerender } = renderTable({ query: "d03" })
    expect(bodyRows()).toHaveLength(1)
    expect(rowTlas()).toEqual(["D03"])

    rerender(
      <PickerTable
        heading="Drivers"
        assets={DRIVERS}
        selected={new Set<string>()}
        quotaFull={false}
        query="LASTNAME5"
        onToggle={vi.fn()}
      />
    )
    expect(rowTlas()).toEqual(["D05"])

    rerender(
      <PickerTable
        heading="Drivers"
        assets={DRIVERS}
        selected={new Set<string>()}
        quotaFull={false}
        query="zzz"
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText("No matches.")).toBeInTheDocument()
  })

  it("sort cycle on Pts updates aria-sort and row order (desc→asc→default)", async () => {
    const user = userEvent.setup()
    renderTable()
    const ptsHeader = () => screen.getByRole("columnheader", { name: /^Pts/ })
    const ptsButton = () => within(ptsHeader()).getByRole("button", { name: /^Pts/ })

    // First click → descending. d8 carries the highest seasonPoints (108).
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "descending")
    expect(rowTlas()[0]).toBe("D08")

    // Second click → ascending.
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "ascending")
    expect(rowTlas()[0]).toBe("D01") // 101 lowest

    // Third click → default (price desc); Pts header no longer sorted.
    await user.click(ptsButton())
    expect(ptsHeader()).toHaveAttribute("aria-sort", "none")
    expect(rowTlas()[0]).toBe("D01") // d1 = 300 most expensive

    // Announcements carry the table heading so the two live regions stay
    // distinguishable for screen readers.
    expect(screen.getByRole("status")).toHaveTextContent("Drivers sorted by Price, descending.")
  })

  it("checkbox reflects selection and disables unselected at quota", () => {
    renderTable({
      selected: new Set(["d1"]),
      quotaFull: true,
    })
    // d1 is selected → enabled checkbox, checked.
    const d1 = screen.getByRole("checkbox", { name: /Firstname Lastname1/ })
    expect(d1).toBeChecked()
    expect(d1).toBeEnabled()
    // d2 is unselected with the kind quota full → disabled.
    const d2 = screen.getByRole("checkbox", { name: /Firstname Lastname2/ })
    expect(d2).not.toBeChecked()
    expect(d2).toBeDisabled()
  })

  it("clicking a checkbox calls onToggle once with the asset id", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderTable({ onToggle })
    await user.click(screen.getByRole("checkbox", { name: /Firstname Lastname1/ }))
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
