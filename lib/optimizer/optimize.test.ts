import type { OptimizerAsset, OptimizerInput, OptimizerResult, TeamPlan } from "./types/optimizer"

import { describe, expect, it } from "vitest"

import { DRS_BOOST_MULTIPLIER, EXTRA_TRANSFER_PENALTY } from "@/lib/constants"

import { OptimizerInputError, optimize } from "./optimize"

// ---------------------------------------------------------------------------
// Brute-force oracle: enumerate EVERYTHING, no pruning, straight from the
// spec formula — the ground truth optimize() must match field-for-field.
// ---------------------------------------------------------------------------

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]]
  const out: T[][] = []
  for (let i = 0; i <= items.length - k; i++) {
    const head = items[i]
    if (head === undefined) continue
    for (const rest of combinations(items.slice(i + 1), k - 1)) {
      out.push([head, ...rest])
    }
  }
  return out
}

function bruteForce(input: OptimizerInput): OptimizerResult {
  const mode = input.mode ?? "normal"
  const budgetEnforced = mode !== "limitless"
  const unlimited =
    mode === "wildcard" || mode === "limitless" || input.freeTransfers === "unlimited"
  const f = unlimited ? Number.POSITIVE_INFINITY : (input.freeTransfers as number)
  const rosterSet = new Set(input.roster)
  const byId = new Map(input.assets.map((a) => [a.id, a]))
  const purse =
    input.budgetTenths + input.roster.reduce((sum, id) => sum + (byId.get(id)?.priceTenths ?? 0), 0)

  const drivers = input.assets.filter((a) => a.kind === "driver")
  const constructors = input.assets.filter((a) => a.kind === "constructor")

  const teamKey = (team: OptimizerAsset[]) => {
    const d = team
      .filter((a) => a.kind === "driver")
      .map((a) => a.id)
      .sort()
    const c = team
      .filter((a) => a.kind === "constructor")
      .map((a) => a.id)
      .sort()
    return `${d.join(",")}|${c.join(",")}`
  }

  const toPlan = (team: OptimizerAsset[]): TeamPlan => {
    const teamDrivers = team.filter((a) => a.kind === "driver")
    let captain = teamDrivers[0]
    for (const d of teamDrivers) {
      if (!captain) {
        captain = d
        continue
      }
      if (
        d.projected > captain.projected ||
        (d.projected === captain.projected && d.id < captain.id)
      ) {
        captain = d
      }
    }
    const cost = team.reduce((s, a) => s + a.priceTenths, 0)
    const transfers = team.filter((a) => !rosterSet.has(a.id)).length
    const raw =
      team.reduce((s, a) => s + a.projected, 0) +
      (DRS_BOOST_MULTIPLIER - 1) * (captain?.projected ?? 0)
    const excess = Math.max(0, transfers - f)
    const penalty = excess > 0 ? EXTRA_TRANSFER_PENALTY * excess : 0 // avoid -0
    return {
      driverIds: teamDrivers.map((a) => a.id).sort(),
      constructorIds: team
        .filter((a) => a.kind === "constructor")
        .map((a) => a.id)
        .sort(),
      captainId: captain?.id ?? "",
      projectedTotal: raw,
      score: raw + penalty,
      transfers,
      penaltyPoints: penalty,
      costTenths: cost,
      budgetLeftTenths: purse - cost,
    }
  }

  const better = (cand: TeamPlan, inc: TeamPlan | null, key: keyof TeamPlan) => {
    if (!inc) return true
    const delta = (cand[key] as number) - (inc[key] as number)
    if (delta !== 0) return delta > 0
    if (cand.costTenths !== inc.costTenths) return cand.costTenths < inc.costTenths
    const candKey = `${cand.driverIds.join(",")}|${cand.constructorIds.join(",")}`
    const incKey = `${inc.driverIds.join(",")}|${inc.constructorIds.join(",")}`
    return candKey < incKey
  }
  void teamKey

  let best: TeamPlan | null = null
  const buckets: (TeamPlan | null)[] = Array.from({ length: 8 }, () => null)

  for (const ds of combinations(drivers, 5)) {
    for (const cs of combinations(constructors, 2)) {
      const team = [...ds, ...cs]
      const cost = team.reduce((s, a) => s + a.priceTenths, 0)
      if (budgetEnforced && cost > purse) continue
      const plan = toPlan(team)
      if (better(plan, best, "score")) best = plan
      if (better(plan, buckets[plan.transfers] ?? null, "projectedTotal")) {
        buckets[plan.transfers] = plan
      }
    }
  }

  if (!best) throw new Error("oracle: no feasible team")
  return { best, byTransferCount: buckets }
}

// ---------------------------------------------------------------------------
// Fixture builders (fixed tables; LCG only for the full-size grid)
// ---------------------------------------------------------------------------

function makeGrid(
  drivers: [string, number, number][],
  constructors: [string, number, number][]
): OptimizerAsset[] {
  return [
    ...drivers.map(
      ([id, priceTenths, projected]): OptimizerAsset => ({
        id,
        kind: "driver",
        priceTenths,
        projected,
      })
    ),
    ...constructors.map(
      ([id, priceTenths, projected]): OptimizerAsset => ({
        id,
        kind: "constructor",
        priceTenths,
        projected,
      })
    ),
  ]
}

// Grid A: 8 drivers / 4 constructors → C(8,5)·C(4,2) = 336 teams.
const GRID_A = makeGrid(
  [
    ["d0", 50, 5],
    ["d1", 60, 8],
    ["d2", 70, 7],
    ["d3", 80, 10],
    ["d4", 100, 12],
    ["d5", 120, 15],
    ["d6", 150, 18],
    ["d7", 200, 25],
  ],
  [
    ["c0", 80, 10],
    ["c1", 100, 14],
    ["c2", 140, 20],
    ["c3", 180, 26],
  ]
)
const ROSTER_A = ["d0", "d1", "d2", "d3", "d4", "c0", "c1"] // cost 540

function inputA(overrides?: Partial<OptimizerInput>): OptimizerInput {
  return {
    assets: GRID_A,
    roster: ROSTER_A,
    budgetTenths: 200,
    freeTransfers: 2,
    ...overrides,
  }
}

/** Deterministic LCG for the full-size synthetic grid. */
function makeFullGrid(seed: number): {
  assets: OptimizerAsset[]
  roster: string[]
} {
  let state = seed >>> 0
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
  const drivers: [string, number, number][] = []
  for (let i = 0; i < 22; i++) {
    const price = 38 + Math.round(next() * 270) // 38..308 tenths
    const projected = price / 12 + next() * 8 // loosely price-correlated
    drivers.push([`d${String(i).padStart(2, "0")}`, price, projected])
  }
  const constructors: [string, number, number][] = []
  for (let i = 0; i < 11; i++) {
    const price = 60 + Math.round(next() * 250)
    const projected = price / 6 + next() * 10
    constructors.push([`c${String(i).padStart(2, "0")}`, price, projected])
  }
  const roster = [
    drivers[0]?.[0],
    drivers[5]?.[0],
    drivers[10]?.[0],
    drivers[15]?.[0],
    drivers[20]?.[0],
    constructors[2]?.[0],
    constructors[7]?.[0],
  ].filter((x): x is string => x !== undefined)
  return { assets: makeGrid(drivers, constructors), roster }
}

// ---------------------------------------------------------------------------

describe("optimality vs brute-force oracle", () => {
  const scenarios: [string, OptimizerInput][] = [
    ["grid A, normal budget", inputA()],
    ["grid A, tight budget (purse = roster cost)", inputA({ budgetTenths: 0 })],
    ["grid A, generous budget (everything affordable)", inputA({ budgetTenths: 600 })],
    ["grid A, 3 free transfers", inputA({ freeTransfers: 3 })],
    ["grid A, wildcard", inputA({ mode: "wildcard" })],
    ["grid A, limitless", inputA({ mode: "limitless" })],
  ]

  for (const [name, input] of scenarios) {
    it(`global best matches the oracle — ${name}`, () => {
      expect(optimize(input).best).toEqual(bruteForce(input).best)
    })

    it(`every transfer bucket matches the oracle — ${name}`, () => {
      expect(optimize(input).byTransferCount).toEqual(bruteForce(input).byTransferCount)
    })
  }

  it("mid-size grid (16/8) matches the oracle end to end", () => {
    const drivers: [string, number, number][] = []
    for (let i = 0; i < 16; i++) {
      drivers.push([`d${String(i).padStart(2, "0")}`, 40 + i * 11, 4 + ((i * 7) % 19)])
    }
    const constructors: [string, number, number][] = []
    for (let i = 0; i < 8; i++) {
      constructors.push([`c${i}`, 70 + i * 17, 8 + ((i * 5) % 13)])
    }
    const input: OptimizerInput = {
      assets: makeGrid(drivers, constructors),
      roster: ["d00", "d03", "d06", "d09", "d12", "c1", "c4"],
      budgetTenths: 180,
      freeTransfers: 2,
    }
    const fast = optimize(input)
    const slow = bruteForce(input)
    expect(fast.best).toEqual(slow.best)
    expect(fast.byTransferCount).toEqual(slow.byTransferCount)
  })
})

describe("exact budget boundary (integer-tenths semantics)", () => {
  // T* = {d3,d4,d5,d6,d7} + {c2,c3}: drivers 650 + pair 320 = 970 exactly.
  // Roster costs 540, so budget 430 → purse exactly 970.
  const T_STAR_DRIVERS = ["d3", "d4", "d5", "d6", "d7"]
  const T_STAR_CONSTRUCTORS = ["c2", "c3"]

  it("a team costing exactly the purse is feasible and wins", () => {
    const result = optimize(inputA({ budgetTenths: 430, mode: "wildcard" }))
    expect(result.best.driverIds).toEqual(T_STAR_DRIVERS)
    expect(result.best.constructorIds).toEqual(T_STAR_CONSTRUCTORS)
    expect(result.best.costTenths).toBe(970)
    expect(result.best.budgetLeftTenths).toBe(0)
  })

  it("one tenth less and the exact-fit team is excluded", () => {
    const input = inputA({ budgetTenths: 429, mode: "wildcard" })
    const result = optimize(input)
    expect(result.best.costTenths).toBeLessThanOrEqual(969)
    expect(
      result.best.driverIds.join() === T_STAR_DRIVERS.join() &&
        result.best.constructorIds.join() === T_STAR_CONSTRUCTORS.join()
    ).toBe(false)
    expect(result.best).toEqual(bruteForce(input).best)
  })
})

describe("penalty accounting", () => {
  it("bucket t scores raw − 10·(t − f)", () => {
    const result = optimize(inputA({ budgetTenths: 600 }))
    for (let t = 0; t < 8; t++) {
      const plan = result.byTransferCount[t]
      if (!plan) continue
      const excess = Math.max(0, t - 2)
      const expected = excess > 0 ? EXTRA_TRANSFER_PENALTY * excess : 0
      expect(plan.penaltyPoints).toBe(expected)
      expect(plan.score).toBeCloseTo(plan.projectedTotal + expected, 9)
      expect(plan.transfers).toBe(t)
    }
    // at least one bucket beyond the free allowance exists in this grid
    expect(result.byTransferCount[4]?.penaltyPoints).toBe(-20)
  })

  it("the global best folds the penalty (can differ from the raw frontier)", () => {
    const result = optimize(inputA())
    const rawBest = result.byTransferCount
      .filter((p): p is TeamPlan => p !== null)
      .reduce((a, b) => (b.projectedTotal > a.projectedTotal ? b : a))
    // global best maximizes score, not raw points
    for (const plan of result.byTransferCount) {
      if (plan) expect(result.best.score).toBeGreaterThanOrEqual(plan.score)
    }
    expect(rawBest.projectedTotal).toBeGreaterThanOrEqual(result.best.projectedTotal)
  })
})

describe("captain co-optimization", () => {
  it("a superstar-captain team beats a higher-sum team at the same price", () => {
    // The budget forces an exclusive choice (purse covers exactly 180 of
    // drivers + the constructors):
    //   A: star(30) + four 5s   → cost 180, sum 50, captain 30 → raw 80
    //   B: five 12s             → cost 180, sum 60, captain 12 → raw 72
    // Without the captain term B wins on sum (60 > 50); WITH it A wins —
    // proving the DRS pick is co-optimized, not bolted on. Any mix
    // (star + a 12) costs ≥ 196 and is unaffordable.
    const grid = makeGrid(
      [
        ["star", 100, 30],
        ["f1", 20, 5],
        ["f2", 20, 5],
        ["f3", 20, 5],
        ["f4", 20, 5],
        ["y1", 36, 12],
        ["y2", 36, 12],
        ["y3", 36, 12],
        ["y4", 36, 12],
        ["y5", 36, 12],
      ],
      [
        ["c0", 10, 0],
        ["c1", 10, 0],
      ]
    )
    const result = optimize({
      assets: grid,
      roster: ["y1", "y2", "y3", "y4", "y5", "c0", "c1"], // cost 200 = purse
      budgetTenths: 0,
      freeTransfers: "unlimited",
    })
    expect(result.best.driverIds).toEqual(["f1", "f2", "f3", "f4", "star"])
    expect(result.best.captainId).toBe("star")
    expect(result.best.projectedTotal).toBeCloseTo(50 + 30, 9)
    expect(result.best.costTenths).toBe(200)
  })
})

describe("transfer counting and buckets", () => {
  it("bucket 0 is the current roster with its best captain", () => {
    const result = optimize(inputA())
    const bucket0 = result.byTransferCount[0]
    expect(bucket0?.driverIds).toEqual(["d0", "d1", "d2", "d3", "d4"])
    expect(bucket0?.constructorIds).toEqual(["c0", "c1"])
    expect(bucket0?.captainId).toBe("d4") // highest-projection roster driver
    expect(bucket0?.transfers).toBe(0)
    expect(bucket0?.penaltyPoints).toBe(0)
  })

  it("bucket index equals net transfers |T \\ R| for every bucket", () => {
    const result = optimize(inputA({ budgetTenths: 600 }))
    const rosterSet = new Set(ROSTER_A)
    result.byTransferCount.forEach((plan, t) => {
      if (!plan) return
      const netSwaps = [...plan.driverIds, ...plan.constructorIds].filter(
        (id) => !rosterSet.has(id)
      ).length
      expect(netSwaps).toBe(t)
    })
  })

  it("unreachable buckets are null (every swap unaffordable)", () => {
    const grid = makeGrid(
      [
        ["d0", 10, 1],
        ["d1", 10, 1],
        ["d2", 10, 1],
        ["d3", 10, 1],
        ["d4", 10, 1],
        ["rich1", 100, 50],
        ["rich2", 100, 50],
      ],
      [
        ["c0", 10, 1],
        ["c1", 10, 1],
        ["richc", 100, 50],
      ]
    )
    const result = optimize({
      assets: grid,
      roster: ["d0", "d1", "d2", "d3", "d4", "c0", "c1"],
      budgetTenths: 0, // purse 70: any swap to a 100-tenth asset overflows
      freeTransfers: 2,
    })
    expect(result.byTransferCount[0]).not.toBeNull()
    for (let t = 1; t < 8; t++) expect(result.byTransferCount[t]).toBeNull()
    expect(result.best.transfers).toBe(0)
  })
})

describe("modes", () => {
  it("wildcard: budget enforced, penalty always 0", () => {
    const result = optimize(inputA({ mode: "wildcard" }))
    for (const plan of [result.best, ...result.byTransferCount]) {
      if (!plan) continue
      expect(plan.penaltyPoints).toBe(0)
      expect(plan.score).toBe(plan.projectedTotal)
      expect(plan.costTenths).toBeLessThanOrEqual(740) // purse respected
    }
  })

  it("limitless: budget skipped; the raw-max team wins even if unaffordable", () => {
    const result = optimize(inputA({ budgetTenths: 0, mode: "limitless" }))
    // raw max = top-projection team regardless of cost (970 > purse 540)
    expect(result.best.driverIds).toEqual(["d3", "d4", "d5", "d6", "d7"])
    expect(result.best.constructorIds).toEqual(["c2", "c3"])
    expect(result.best.costTenths).toBe(970)
    expect(result.best.budgetLeftTenths).toBe(540 - 970) // signed-truthful
    expect(result.best.penaltyPoints).toBe(0)
  })

  it("first-race unlimited transfers (normal mode): budget yes, penalty no", () => {
    const result = optimize(inputA({ freeTransfers: "unlimited" }))
    expect(result.best.penaltyPoints).toBe(0)
    expect(result.best.costTenths).toBeLessThanOrEqual(740)
  })
})

describe("validation", () => {
  it("throws on a roster that is not 7 ids", () => {
    expect(() => optimize(inputA({ roster: ["d0"] }))).toThrow(OptimizerInputError)
    expect(() => optimize(inputA({ roster: ["d0"] }))).toThrow(/roster must have 7/)
  })

  it("throws on a 4+3 roster split", () => {
    expect(() => optimize(inputA({ roster: ["d0", "d1", "d2", "d3", "c0", "c1", "c2"] }))).toThrow(
      /5 drivers \+ 2 constructors/
    )
  })

  it("throws on unknown roster ids and duplicates", () => {
    expect(() =>
      optimize(inputA({ roster: ["nope", "d1", "d2", "d3", "d4", "c0", "c1"] }))
    ).toThrow(/not found/)
    expect(() => optimize(inputA({ roster: ["d0", "d0", "d2", "d3", "d4", "c0", "c1"] }))).toThrow(
      /duplicate/
    )
  })

  it("throws on a grid too small to field a team", () => {
    const tiny = GRID_A.filter((a) => a.kind === "constructor" || a.id < "d4")
    expect(() => optimize(inputA({ assets: tiny }))).toThrow(/grid too small/)
  })

  it("throws on non-integer money and bad freeTransfers", () => {
    const floaty = makeGrid([["d0", 50.5, 5]], [])
    expect(() =>
      optimize(inputA({ assets: [...GRID_A.filter((a) => a.id !== "d0"), ...floaty] }))
    ).toThrow(/non-integer/)
    expect(() => optimize(inputA({ budgetTenths: 10.5 }))).toThrow(/budgetTenths/)
    expect(() => optimize(inputA({ freeTransfers: -1 }))).toThrow(/freeTransfers/)
  })
})

describe("full-size grid (22 drivers / 11 constructors)", () => {
  it("is deterministic (two runs, deep-equal)", () => {
    const { assets, roster } = makeFullGrid(1)
    const input: OptimizerInput = {
      assets,
      roster,
      budgetTenths: 150,
      freeTransfers: 2,
    }
    expect(optimize(input)).toEqual(optimize(input))
  })

  it("completes well under the CI tripwire (real numbers come from pnpm bench)", () => {
    const { assets, roster } = makeFullGrid(2)
    const start = performance.now()
    optimize({
      assets,
      roster,
      budgetTenths: 150,
      freeTransfers: 2,
      mode: "limitless",
    })
    // Smoke, not a benchmark: unloaded this is ~7ms (pnpm bench is the
    // record), but with the full suite saturating every core it has measured
    // 300ms+. 1s still catches an algorithmic regression (losing the prune or
    // the SoA layout is a >10× blowup) without flaking under parallel load.
    expect(performance.now() - start).toBeLessThan(1_000)
  })

  it("all money fields are integers across every returned plan", () => {
    const { assets, roster } = makeFullGrid(3)
    const result = optimize({
      assets,
      roster,
      budgetTenths: 137,
      freeTransfers: 3,
    })
    for (const plan of [result.best, ...result.byTransferCount]) {
      if (!plan) continue
      expect(Number.isInteger(plan.costTenths)).toBe(true)
      expect(Number.isInteger(plan.budgetLeftTenths)).toBe(true)
    }
  })
})
