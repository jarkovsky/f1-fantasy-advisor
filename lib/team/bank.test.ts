import { describe, expect, it } from "vitest"

import { formatBankTenths, parseBank } from "./bank"

describe("parseBank", () => {
  it("treats blank / whitespace as not entered", () => {
    expect(parseBank("")).toEqual({ entered: false, tenths: 0 })
    expect(parseBank("   ")).toEqual({ entered: false, tenths: 0 })
  })

  it("rejects negative and non-numeric input", () => {
    expect(parseBank("-1")).toEqual({ entered: false, tenths: 0 })
    expect(parseBank("abc")).toEqual({ entered: false, tenths: 0 })
  })

  it("accepts zero and positive values as tenths", () => {
    expect(parseBank("0")).toEqual({ entered: true, tenths: 0 })
    expect(parseBank("2.5")).toEqual({ entered: true, tenths: 25 })
  })

  it("rounds to the nearest tenth", () => {
    expect(parseBank("2.55")).toEqual({ entered: true, tenths: 26 })
    expect(parseBank("2.54")).toEqual({ entered: true, tenths: 25 })
  })
})

describe("formatBankTenths", () => {
  it("renders one decimal", () => {
    expect(formatBankTenths(25)).toBe("2.5")
    expect(formatBankTenths(0)).toBe("0.0")
    expect(formatBankTenths(100)).toBe("10.0")
  })
})
