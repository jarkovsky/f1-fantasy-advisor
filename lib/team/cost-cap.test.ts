import { describe, expect, it } from "vitest"

import { formatCostCapTenths, parseCostCap } from "./cost-cap"

describe("parseCostCap", () => {
  it("treats blank / whitespace as not entered", () => {
    expect(parseCostCap("")).toEqual({ entered: false, tenths: 0 })
    expect(parseCostCap("   ")).toEqual({ entered: false, tenths: 0 })
  })

  it("rejects negative and non-numeric input", () => {
    expect(parseCostCap("-1")).toEqual({ entered: false, tenths: 0 })
    expect(parseCostCap("abc")).toEqual({ entered: false, tenths: 0 })
  })

  it("accepts zero and positive values as tenths", () => {
    expect(parseCostCap("0")).toEqual({ entered: true, tenths: 0 })
    expect(parseCostCap("2.5")).toEqual({ entered: true, tenths: 25 })
  })

  it("rounds to the nearest tenth", () => {
    expect(parseCostCap("2.55")).toEqual({ entered: true, tenths: 26 })
    expect(parseCostCap("2.54")).toEqual({ entered: true, tenths: 25 })
  })
})

describe("formatCostCapTenths", () => {
  it("renders one decimal", () => {
    expect(formatCostCapTenths(25)).toBe("2.5")
    expect(formatCostCapTenths(0)).toBe("0.0")
    expect(formatCostCapTenths(100)).toBe("10.0")
  })
})
