import type { TeamPlan } from "@/lib/optimizer/types/optimizer"

import { describe, expect, it } from "vitest"

import { diffSquad, slotRows } from "./squad-diff"

function plan(driverIds: string[], constructorIds: string[]): TeamPlan {
  return {
    driverIds,
    constructorIds,
    captainId: driverIds[0] ?? "",
    projectedTotal: 0,
    score: 0,
    transfers: 0,
    penaltyPoints: 0,
    costTenths: 0,
    budgetLeftTenths: 0,
  }
}

describe("diffSquad", () => {
  it("computes the symmetric diff by class", () => {
    const base = plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const next = plan(["d1", "d2", "d3", "d4", "d6"], ["c1", "c3"])
    const diff = diffSquad(base, next)
    expect(diff.drivers).toEqual([{ outId: "d5", inId: "d6" }])
    expect(diff.constructors).toEqual([{ outId: "c2", inId: "c3" }])
  })

  it("pads unequal ins/outs with null", () => {
    const base = plan(["d1", "d2"], [])
    const next = plan(["d1", "d2", "d3"], [])
    expect(diffSquad(base, next).drivers).toEqual([{ outId: null, inId: "d3" }])
  })

  it("null baseline → every plan id is an incoming with no out", () => {
    const next = plan(["d1", "d2"], ["c1"])
    const diff = diffSquad(null, next)
    expect(diff.drivers).toEqual([
      { outId: null, inId: "d1" },
      { outId: null, inId: "d2" },
    ])
    expect(diff.constructors).toEqual([{ outId: null, inId: "c1" }])
  })
})

describe("slotRows", () => {
  it("classifies kept vs incoming and pairs the out", () => {
    const base = plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const next = plan(["d1", "d2", "d3", "d4", "d6"], ["c1", "c3"])
    const rows = slotRows(base, next, diffSquad(base, next))
    expect(rows.drivers).toEqual([
      { inId: "d1", outId: null },
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

  it("every plan id appears exactly once across slot rows", () => {
    const base = plan(["d1", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const next = plan(["d6", "d2", "d3", "d4", "d5"], ["c1", "c2"])
    const rows = slotRows(base, next, diffSquad(base, next))
    const ids = [...rows.drivers, ...rows.constructors].map((r) => r.inId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice().sort()).toEqual([...next.driverIds, ...next.constructorIds].sort())
  })

  it("null baseline → all kept-style rows (no out)", () => {
    const next = plan(["d1", "d2"], ["c1"])
    const rows = slotRows(null, next, diffSquad(null, next))
    expect(rows.drivers.every((r) => r.outId === null)).toBe(true)
    expect(rows.constructors.every((r) => r.outId === null)).toBe(true)
  })
})
