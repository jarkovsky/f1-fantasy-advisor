import { describe, expect, it } from "vitest"

import {
  formatDateISO,
  formatDeltaTenths,
  formatOrdinal,
  formatPoints,
  formatPriceTenths,
  formatSignedPoints,
} from "@/lib/format"

describe("formatPriceTenths", () => {
  it("prints one decimal with a $…M wrapper", () => {
    expect(formatPriceTenths(265)).toBe("$26.5M")
  })

  it("keeps the trailing .0 for integer prices", () => {
    expect(formatPriceTenths(300)).toBe("$30.0M")
  })

  it("handles small values", () => {
    expect(formatPriceTenths(45)).toBe("$4.5M")
  })
})

describe("formatDeltaTenths", () => {
  it("renders a middle dot for zero", () => {
    expect(formatDeltaTenths(0)).toBe("·")
  })

  it("prefixes a plain plus for a rise", () => {
    expect(formatDeltaTenths(3)).toBe("+0.3")
  })

  it("prefixes U+2212 (not hyphen) for a drop", () => {
    expect(formatDeltaTenths(-3)).toBe("−0.3")
  })

  it("uses plain division for magnitude (10 → 1, not 1.0)", () => {
    expect(formatDeltaTenths(10)).toBe("+1")
    expect(formatDeltaTenths(-10)).toBe("−1")
  })
})

describe("formatPoints", () => {
  it("renders an em dash for null", () => {
    expect(formatPoints(null)).toBe("—")
  })

  it("renders the bare number when scored", () => {
    expect(formatPoints(11)).toBe("11")
    expect(formatPoints(0)).toBe("0")
    expect(formatPoints(-8)).toBe("-8")
    expect(formatPoints(11.5)).toBe("11.5")
  })
})

describe("formatSignedPoints", () => {
  it("renders a middle dot for zero", () => {
    expect(formatSignedPoints(0)).toBe("·")
  })

  it("prefixes a plain plus for positive", () => {
    expect(formatSignedPoints(11)).toBe("+11")
  })

  it("prefixes U+2212 (not hyphen) for negative", () => {
    expect(formatSignedPoints(-8)).toBe("−8")
  })

  it("rounds float projections to one decimal", () => {
    expect(formatSignedPoints(79.59363858951383)).toBe("+79.6")
    expect(formatSignedPoints(-11.884173915113747)).toBe("−11.9")
  })

  it("collapses near-zero to the middle dot (incl. -0)", () => {
    expect(formatSignedPoints(0.04)).toBe("·")
    expect(formatSignedPoints(-0.04)).toBe("·")
  })
})

describe("formatDateISO", () => {
  it("renders a TZ-stable YYYY-MM-DD slice", () => {
    expect(formatDateISO(Date.UTC(2026, 5, 5))).toBe("2026-06-05")
  })

  it("takes the UTC date even near a day boundary", () => {
    // 23:30 UTC stays on the same UTC day regardless of the runner's TZ.
    expect(formatDateISO(Date.UTC(2026, 0, 1, 23, 30))).toBe("2026-01-01")
  })
})

describe("formatOrdinal", () => {
  it("suffixes 1st/2nd/3rd and the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(formatOrdinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "101st",
      "111th",
    ])
  })
})
