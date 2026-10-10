import { describe, expect, it } from "vitest"

import { optimize } from "./optimize"
import type { OptimizerAsset } from "./types/optimizer"

import { pickDrsCaptainId } from "./drs-boost"

describe("pickDrsCaptainId", () => {
  it("picks the highest projection", () => {
    const proj: Record<string, number> = { a: 1, b: 5, c: 3 }
    expect(pickDrsCaptainId(["a", "b", "c"], (id) => proj[id] ?? 0)).toBe("b")
  })

  it("breaks ties by the lower id", () => {
    const proj: Record<string, number> = { z: 5, a: 5, m: 5 }
    expect(pickDrsCaptainId(["z", "a", "m"], (id) => proj[id] ?? 0)).toBe("a")
  })

  it("returns null for an empty list", () => {
    expect(pickDrsCaptainId([], () => 0)).toBeNull()
  })

  it("agrees with the optimizer's captain choice on a real plan", () => {
    const grid: OptimizerAsset[] = [
      { id: "d0", kind: "driver", priceTenths: 50, projected: 5 },
      { id: "d1", kind: "driver", priceTenths: 60, projected: 8 },
      { id: "d2", kind: "driver", priceTenths: 70, projected: 7 },
      { id: "d3", kind: "driver", priceTenths: 80, projected: 10 },
      { id: "d4", kind: "driver", priceTenths: 100, projected: 12 },
      { id: "d5", kind: "driver", priceTenths: 120, projected: 15 },
      { id: "d6", kind: "driver", priceTenths: 150, projected: 18 },
      { id: "d7", kind: "driver", priceTenths: 200, projected: 25 },
      { id: "c0", kind: "constructor", priceTenths: 80, projected: 10 },
      { id: "c1", kind: "constructor", priceTenths: 100, projected: 14 },
      { id: "c2", kind: "constructor", priceTenths: 140, projected: 20 },
      { id: "c3", kind: "constructor", priceTenths: 180, projected: 26 },
    ]
    const projById = new Map(grid.map((a) => [a.id, a.projected]))
    const result = optimize({
      assets: grid,
      roster: ["d0", "d1", "d2", "d3", "d4", "c0", "c1"],
      budgetTenths: 400,
      freeTransfers: 2,
    })
    expect(pickDrsCaptainId(result.best.driverIds, (id) => projById.get(id) ?? 0)).toBe(
      result.best.captainId
    )
  })
})
