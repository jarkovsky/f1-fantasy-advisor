import { describe, expect, it } from "vitest"

import { announce, formatRemaining, milestoneFor } from "./countdown"

describe("milestoneFor", () => {
  it("buckets by remaining time, boundaries inclusive on the lower edge", () => {
    expect(milestoneFor(0)).toBe("locked")
    expect(milestoneFor(-1)).toBe("locked")
    expect(milestoneFor(60_000)).toBe("1m") // exactly 1 min
    expect(milestoneFor(60_001)).toBe("5m")
    expect(milestoneFor(5 * 60_000)).toBe("5m")
    expect(milestoneFor(5 * 60_000 + 1)).toBe("15m")
    expect(milestoneFor(15 * 60_000)).toBe("15m")
    expect(milestoneFor(15 * 60_000 + 1)).toBe("1h")
    expect(milestoneFor(60 * 60_000)).toBe("1h")
    expect(milestoneFor(60 * 60_000 + 1)).toBe("mount")
  })
})

describe("formatRemaining", () => {
  it("uses d/h/m at or above an hour, m/s below", () => {
    expect(formatRemaining(2 * 86_400_000 + 14 * 3_600_000 + 33 * 60_000)).toBe("2d 14h 33m")
    expect(formatRemaining(14 * 3_600_000 + 33 * 60_000)).toBe("14h 33m")
    expect(formatRemaining(14 * 60_000 + 12_000)).toBe("14m 12s")
    expect(formatRemaining(0)).toBe("0m 0s")
    expect(formatRemaining(-5000)).toBe("0m 0s")
  })
})

describe("announce", () => {
  it("returns the locked message or a lock-in duration", () => {
    expect(announce("locked", 0)).toBe("Team locked.")
    expect(announce("5m", 4 * 60_000 + 30_000)).toBe("Lock in 4m 30s.")
  })
})
