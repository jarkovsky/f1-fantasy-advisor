import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { StatsTable } from "./stats-table"
import type { StatsRow } from "./stats-row"

// ---------------------------------------------------------------------------
// Hand-rolled rows with distinctive, non-monotonic values so numeric sorting,
// null-last ordering, and the Δ-price conventions are all unambiguous:
//  - D-ALF: negative Δ, top season pts, has sprint
//  - D-BRA: zero Δ, null form5 + null sprint (never scored / non-sprint)
//  - D-CHA: positive Δ, mid pts
//  - D-DEL: positive Δ, lowest pts, cheapest price
//  - 2 constructors (distinct kind, own counts)
// ---------------------------------------------------------------------------

function row(over: Partial<StatsRow> & Pick<StatsRow, "playerId" | "tla">): StatsRow {
  return {
    kind: "driver",
    displayName: over.tla,
    teamName: "Team",
    colorKey: "27",
    priceTenths: 300,
    priceDeltaTenths: 0,
    seasonPoints: 100,
    ppm: 3,
    form5: 10,
    qualiAvg: 5,
    raceAvg: 8,
    sprintAvg: 2,
    selectedPercent: 50,
    captainSelectedPercent: 10,
    spark: [10, 30, 60],
    ...over,
  }
}

const ROWS: StatsRow[] = [
  row({
    playerId: "alf",
    tla: "ALF",
    priceTenths: 320,
    priceDeltaTenths: -5,
    seasonPoints: 200,
    form5: 40,
    sprintAvg: 6,
    spark: [50, 120, 200],
  }),
  row({
    playerId: "bra",
    tla: "BRA",
    priceTenths: 150,
    priceDeltaTenths: 0,
    seasonPoints: 80,
    form5: null,
    sprintAvg: null,
    spark: [], // empty series → no sparkline
  }),
  row({
    playerId: "cha",
    tla: "CHA",
    priceTenths: 250,
    priceDeltaTenths: 3,
    seasonPoints: 140,
    form5: 20,
    spark: [40, 90, 140],
  }),
  row({
    playerId: "del",
    tla: "DEL",
    priceTenths: 100,
    priceDeltaTenths: 12,
    seasonPoints: 50,
    form5: 5,
    spark: [25, 50],
  }),
  row({
    playerId: "ctr1",
    tla: "CT1",
    kind: "constructor",
    colorKey: "ctr1",
    priceTenths: 280,
    priceDeltaTenths: 2,
    seasonPoints: 300,
    spark: [100, 200, 300],
  }),
  row({
    playerId: "ctr2",
    tla: "CT2",
    kind: "constructor",
    colorKey: "ctr2",
    priceTenths: 220,
    priceDeltaTenths: -4,
    seasonPoints: 260,
    spark: [80, 180, 260],
  }),
]

function renderTable() {
  return render(<StatsTable rows={ROWS} caption="Race 6 caption" />)
}

/** TLAs in the first column, in DOM (= sorted) order, for the active panel. */
function tlaOrder(): string[] {
  const rows = screen.getAllByRole("row")
  // Drop the header row (row[0]); read the mono TLA span in each body row.
  return rows.slice(1).map((r) => {
    const cells = within(r).getAllByRole("cell")
    const first = cells[0]
    return first ? (first.textContent?.match(/^[A-Z0-9]{3}/)?.[0] ?? "") : ""
  })
}

function header(name: RegExp): HTMLElement {
  return screen.getByRole("columnheader", { name })
}

function sortButton(name: RegExp): HTMLElement {
  return within(header(name)).getByRole("button")
}

describe("StatsTable", () => {
  it("defaults to Season pts descending with aria-sort on that header", () => {
    renderTable()
    expect(header(/Season pts/)).toHaveAttribute("aria-sort", "descending")
    // Other numeric headers are aria-sort=none.
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "none")
    // Drivers (default tab) by season pts desc: ALF 200, CHA 140, BRA 80, DEL 50.
    expect(tlaOrder()).toEqual(["ALF", "CHA", "BRA", "DEL"])
  })

  it("clicking Price cycles desc → asc → back to default; aria-sort tracks it", async () => {
    const user = userEvent.setup()
    renderTable()

    // 1st click → Price desc: 320,250,150,100 → ALF,CHA,BRA,DEL.
    await user.click(sortButton(/Price/))
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "descending")
    expect(header(/Season pts/)).toHaveAttribute("aria-sort", "none")
    expect(tlaOrder()).toEqual(["ALF", "CHA", "BRA", "DEL"])

    // 2nd click → Price asc: 100,150,250,320 → DEL,BRA,CHA,ALF.
    await user.click(sortButton(/Price/))
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "ascending")
    expect(tlaOrder()).toEqual(["DEL", "BRA", "CHA", "ALF"])

    // 3rd click → back to default (Season pts desc).
    await user.click(sortButton(/Price/))
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "none")
    expect(header(/Season pts/)).toHaveAttribute("aria-sort", "descending")
    expect(tlaOrder()).toEqual(["ALF", "CHA", "BRA", "DEL"])
  })

  it("Δ price sorts numerically with negatives (not lexicographic)", async () => {
    const user = userEvent.setup()
    renderTable()
    // Deltas: ALF −5, BRA 0, CHA +3, DEL +12. Desc numeric: 12,3,0,−5.
    await user.click(sortButton(/Δ price/))
    expect(tlaOrder()).toEqual(["DEL", "CHA", "BRA", "ALF"])
    // Asc numeric: −5,0,3,12 — a lexicographic sort would mis-order "−5".
    await user.click(sortButton(/Δ price/))
    expect(tlaOrder()).toEqual(["ALF", "BRA", "CHA", "DEL"])
  })

  it("nulls sort last in BOTH directions (Form-5: BRA is null)", async () => {
    const user = userEvent.setup()
    renderTable()
    // form5: ALF 40, CHA 20, DEL 5, BRA null. Desc → null last.
    await user.click(sortButton(/Form-5/))
    expect(tlaOrder()).toEqual(["ALF", "CHA", "DEL", "BRA"])
    // Asc → 5,20,40 then null STILL last (not first).
    await user.click(sortButton(/Form-5/))
    expect(tlaOrder()).toEqual(["DEL", "CHA", "ALF", "BRA"])
  })

  it("tabs show only their kind with counts, and switching resets sort to default", async () => {
    const user = userEvent.setup()
    renderTable()
    expect(screen.getByRole("tab", { name: "Drivers (4)" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Constructors (2)" })).toBeInTheDocument()

    // Change sort on the drivers tab.
    await user.click(sortButton(/Price/))
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "descending")

    // Switch to constructors: only 2 constructor rows, default sort restored.
    await user.click(screen.getByRole("tab", { name: /constructors/i }))
    expect(tlaOrder()).toEqual(["CT1", "CT2"]) // season pts 300,260 desc
    expect(header(/Season pts/)).toHaveAttribute("aria-sort", "descending")
    expect(header(/^Price/)).toHaveAttribute("aria-sort", "none")
  })

  it("renders a sparkline svg per row (aria-hidden) and none for an empty series", () => {
    renderTable()
    const rows = screen.getAllByRole("row").slice(1)
    for (const r of rows) {
      const tla = within(r).getAllByRole("cell")[0]?.textContent ?? ""
      const svg = r.querySelector("svg")
      if (tla.startsWith("BRA")) {
        expect(svg).toBeNull() // empty series → nothing rendered
      } else {
        expect(svg).not.toBeNull()
        expect(svg).toHaveAttribute("aria-hidden", "true")
      }
    }
  })

  it("sr-only live region exists from first render and updates on sort", async () => {
    const user = userEvent.setup()
    renderTable()
    const status = screen.getByRole("status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent("") // empty before any sort change
    await user.click(sortButton(/Price/))
    expect(status).toHaveTextContent("Sorted by Price, descending.")
    await user.click(sortButton(/Price/))
    expect(status).toHaveTextContent("Sorted by Price, ascending.")
  })

  it("Δ price renders U+2212 minus and the middle-dot zero from lib/format", () => {
    renderTable()
    // ALF has −5 tenths → "−0.5" with U+2212 (not hyphen-minus).
    expect(screen.getByText("−0.5")).toBeInTheDocument()
    // BRA has 0 → bare middle dot "·".
    expect(screen.getByText("·")).toBeInTheDocument()
    // DEL has +12 tenths → "+1.2".
    expect(screen.getByText("+1.2")).toBeInTheDocument()
  })
})
