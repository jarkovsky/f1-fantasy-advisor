import type { TeamPlan } from "@/lib/optimizer/types/optimizer"

import { describe, expect, it } from "vitest"

import { diffTeam, slotRows } from "./team-diff"

function plan(driverIds: string[], constructorIds: string[]): TeamPlan {
  return {
    driverIds,
    constructorIds,
    boostDriverId: driverIds[0] ?? "",
    projectedTotal: 0,
    score: 0,
    transfers: 0,
    penaltyPoints: 0,
    costTenths: 0,
    remainingCostCapTenths: 0,
  }
}

describe("diffTeam", () => {
  it("computes the symmetric diff by class", () => {
    const base = plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const next = plan(["d1", "d2", "d3", "d4", "d6"], ["c1", "c3"])
    const diff = diffTeam(base, next)
    expect(diff.drivers).toEqual([{ outId: "d5", inId: "d6" }])
    expect(diff.constructors).toEqual([{ outId: "c2", inId: "c3" }])
  })

  it("pads unequal ins/outs with null", () => {
    const base = plan(["d1", "d2"], [])
    const next = plan(["d1", "d2", "d3"], [])
    expect(diffTeam(base, next).drivers).toEqual([{ outId: null, inId: "d3" }])
  })

  it("null baseline → every plan id is an incoming with no out", () => {
    const next = plan(["d1", "d2"], ["c1"])
    const diff = diffTeam(null, next)
    expect(diff.drivers).toEqual([
      { outId: null, inId: "d1" },
      { outId: null, inId: "d2" },
    ])
    expect(diff.constructors).toEqual([{ outId: null, inId: "c1" }])
  })
})

describe("slotRows", () => {
  // Ids sort by their number: the current picks by "price" (d1 priciest), the
  // incoming ones by "projection" (higher number first), so the two orders differ.
  const byCurrent = (a: string, b: string) => a.localeCompare(b)
  const byIncoming = (a: string, b: string) => b.localeCompare(a)
  const order = { byCurrent, byIncoming }

  it("keeps each current pick in its row and fills the leaving rows with the incoming ones", () => {
    const base = plan(["d5", "d2", "d4", "d1", "d3"], ["c2", "c1"])
    const next = plan(["d6", "d2", "d7", "d4", "d3"], ["c1", "c3"])
    const rows = slotRows(base, next, order)
    expect(rows.drivers).toEqual([
      { inId: "d7", outId: "d1" },
      { inId: "d2", outId: null },
      { inId: "d3", outId: null },
      { inId: "d4", outId: null },
      { inId: "d6", outId: "d5" },
    ])
    expect(rows.constructors).toEqual([
      { inId: "c1", outId: null },
      { inId: "c3", outId: "c2" },
    ])
  })

  it("lays the current team out the same way whatever the plan", () => {
    const base = plan(["d3", "d1", "d2", "d4", "d5"], ["c1", "c2"])
    const current = (next: TeamPlan) =>
      slotRows(base, next, order).drivers.map((r) => r.outId ?? r.inId)
    const a = current(plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"]))
    const b = current(plan(["d9", "d2", "d8", "d4", "d5"], ["c1", "c2"]))
    expect(a).toEqual(["d1", "d2", "d3", "d4", "d5"])
    expect(b).toEqual(a)
  })

  it("every plan id appears exactly once across slot rows", () => {
    const base = plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const next = plan(["d6", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const rows = slotRows(base, next, order)
    const ids = [...rows.drivers, ...rows.constructors].map((r) => r.inId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice().sort()).toEqual([...next.driverIds, ...next.constructorIds].sort())
  })

  it("null baseline → all kept-style rows (no out), in incoming order", () => {
    const next = plan(["d1", "d2"], ["c1"])
    const rows = slotRows(null, next, order)
    expect(rows.drivers).toEqual([
      { inId: "d2", outId: null },
      { inId: "d1", outId: null },
    ])
    expect(rows.constructors.every((r) => r.outId === null)).toBe(true)
  })
})
