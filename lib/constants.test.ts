import { describe, expect, it } from "vitest"

import {
  DRS_BOOST_MULTIPLIER,
  EXTRA_TRANSFER_PENALTY,
  FREE_TRANSFERS,
  GRID,
  INITIAL_BUDGET_TENTHS,
  SQUAD_CONSTRUCTORS,
  SQUAD_DRIVERS,
} from "@/lib/constants"

describe("2026 rule constants", () => {
  it("encodes the squad shape (5 drivers + 2 constructors)", () => {
    expect(SQUAD_DRIVERS).toBe(5)
    expect(SQUAD_CONSTRUCTORS).toBe(2)
  })

  it("encodes the 2026 grid (22 drivers, 11 constructors)", () => {
    expect(GRID.drivers).toBe(22)
    expect(GRID.constructors).toBe(11)
  })

  it("encodes the transfer rules (2-3 free, -10 per extra)", () => {
    expect(FREE_TRANSFERS.min).toBe(2)
    expect(FREE_TRANSFERS.max).toBe(3)
    expect(EXTRA_TRANSFER_PENALTY).toBe(-10)
  })

  it("encodes money as integer tenths of a million", () => {
    expect(INITIAL_BUDGET_TENTHS).toBe(1000)
    expect(Number.isInteger(INITIAL_BUDGET_TENTHS)).toBe(true)
  })

  it("encodes the DRS Boost multiplier", () => {
    expect(DRS_BOOST_MULTIPLIER).toBe(2)
  })
})
