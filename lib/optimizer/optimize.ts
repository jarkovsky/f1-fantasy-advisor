/**
 * Exact-search transfer optimizer.
 *
 * Exhaustively enumerates every legal squad — C(22,5) × C(11,2) ≈ 1.45M
 * combinations — and returns the global optimum plus the best squad at every
 * transfer count, in one pass. Pure and synchronous (no I/O); the advisor
 * imports it lazily and runs it in the browser. adapter.ts builds its input
 * from the feed grid and a projections table.
 *
 * score(T) = Σ projected(a) + (DRS_BOOST_MULTIPLIER − 1)·max driver projected
 *            + EXTRA_TRANSFER_PENALTY · max(0, transfers(T) − freeTransfers)
 *
 * The only pruning is budget feasibility. A partial pick is abandoned when
 *   priceSoFar + (sum of the `need` cheapest remaining drivers)
 *              + (cheapest constructor pair)              > purse.
 * Drivers are sorted ascending by price, so the bound is monotonic at each
 * level: once it fails at one index it fails for every later one, and the
 * loop breaks instead of continuing.
 * Proof this never cuts a feasible team T: on T's emission path the cheapest
 * `need`-subset of the remaining suffix lower-bounds T's own remaining
 * drivers, and the cheapest pair lower-bounds T's pair, so the bound is
 * ≤ cost(T) ≤ purse and the prune cannot fire. Score/upper-bound pruning is
 * deliberately omitted: it could discard the optimum of a non-global
 * transfer bucket, and byTransferCount must be optimal in every bucket.
 *
 * Money is integer tenths throughout, so budget-boundary comparisons are exact
 * (a team costing exactly the purse is affordable; one tenth more is not).
 */
import type {
  OptimizerAsset,
  OptimizerInput,
  OptimizerMode,
  OptimizerResult,
  TeamPlan,
} from "./types/optimizer"

import {
  DRS_BOOST_MULTIPLIER,
  EXTRA_TRANSFER_PENALTY,
  SQUAD_CONSTRUCTORS,
  SQUAD_DRIVERS,
} from "@/lib/constants"

import { pickDrsCaptainId } from "./drs-boost"

export class OptimizerInputError extends Error {}

const SQUAD_SIZE = SQUAD_DRIVERS + SQUAD_CONSTRUCTORS
/** Transfer counts run 0..SQUAD_SIZE (every slot swapped). */
const MAX_TRANSFERS = SQUAD_SIZE

// ---------------------------------------------------------------------------
// Internal scratch shape: winners are tracked as dense indices and primitive
// sums; TeamPlan objects are reconstructed once at the end.
// ---------------------------------------------------------------------------

type Scratch = {
  occupied: boolean
  d0: number
  d1: number
  d2: number
  d3: number
  d4: number
  pair: number
  costTenths: number
  projectedTotal: number
  transfers: number
}

function emptyScratch(): Scratch {
  return {
    occupied: false,
    d0: 0,
    d1: 0,
    d2: 0,
    d3: 0,
    d4: 0,
    pair: 0,
    costTenths: 0,
    projectedTotal: 0,
    transfers: 0,
  }
}

export function optimize(input: OptimizerInput): OptimizerResult {
  // ---- validation (programmer errors fail loud) --------------------------
  const mode: OptimizerMode = input.mode ?? "normal"
  if (!["normal", "wildcard", "limitless"].includes(mode)) {
    throw new OptimizerInputError(`unknown mode: ${String(mode)}`)
  }
  if (
    input.freeTransfers !== "unlimited" &&
    (!Number.isInteger(input.freeTransfers) || input.freeTransfers < 0)
  ) {
    throw new OptimizerInputError(
      `freeTransfers must be a non-negative integer or "unlimited", got ${String(input.freeTransfers)}`
    )
  }
  if (!Number.isInteger(input.budgetTenths) || input.budgetTenths < 0) {
    throw new OptimizerInputError(
      `budgetTenths must be a non-negative integer (tenths), got ${String(input.budgetTenths)}`
    )
  }

  const byId = new Map<string, OptimizerAsset>()
  for (const asset of input.assets) {
    if (byId.has(asset.id)) {
      throw new OptimizerInputError(`duplicate asset id: ${asset.id}`)
    }
    if (!Number.isInteger(asset.priceTenths)) {
      throw new OptimizerInputError(
        `asset ${asset.id} has non-integer priceTenths: ${asset.priceTenths}`
      )
    }
    byId.set(asset.id, asset)
  }

  // Check grid size before resolving the roster — otherwise a roster id missing
  // from a too-small grid reports the wrong (less actionable) error.
  const drivers = input.assets.filter((a) => a.kind === "driver")
  const constructors = input.assets.filter((a) => a.kind === "constructor")
  if (drivers.length < SQUAD_DRIVERS || constructors.length < SQUAD_CONSTRUCTORS) {
    throw new OptimizerInputError(
      `grid too small: need ≥${SQUAD_DRIVERS} drivers and ≥${SQUAD_CONSTRUCTORS} constructors, got ${drivers.length} + ${constructors.length}`
    )
  }

  if (input.roster.length !== SQUAD_SIZE) {
    throw new OptimizerInputError(`roster must have ${SQUAD_SIZE} ids, got ${input.roster.length}`)
  }
  const rosterSet = new Set(input.roster)
  if (rosterSet.size !== input.roster.length) {
    throw new OptimizerInputError("roster contains duplicate ids")
  }
  let rosterDrivers = 0
  let rosterConstructors = 0
  let rosterCostTenths = 0
  for (const id of input.roster) {
    const asset = byId.get(id)
    if (!asset) throw new OptimizerInputError(`roster id ${id} not found in assets`)
    if (asset.kind === "driver") rosterDrivers += 1
    else rosterConstructors += 1
    rosterCostTenths += asset.priceTenths
  }
  if (rosterDrivers !== SQUAD_DRIVERS || rosterConstructors !== SQUAD_CONSTRUCTORS) {
    throw new OptimizerInputError(
      `roster must be ${SQUAD_DRIVERS} drivers + ${SQUAD_CONSTRUCTORS} constructors, got ${rosterDrivers} + ${rosterConstructors}`
    )
  }

  // ---- mode fold ----------------------------------------------------------
  const budgetEnforced = mode !== "limitless"
  const unlimited =
    mode === "wildcard" || mode === "limitless" || input.freeTransfers === "unlimited"
  const freeTransfers = unlimited ? Number.POSITIVE_INFINITY : (input.freeTransfers as number)
  // What a full sell-off would leave in the bank: every owned asset is sellable.
  const purseTenths = input.budgetTenths + rosterCostTenths

  // ---- data prep: sort ascending by price, then dense SoA typed arrays -----
  // Every index below (d0..d4, pairI/pairJ) points into these sorted arrays.
  const byPriceThenId = (a: OptimizerAsset, b: OptimizerAsset) =>
    a.priceTenths - b.priceTenths || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  drivers.sort(byPriceThenId)
  constructors.sort(byPriceThenId)
  const inRoster = (asset: OptimizerAsset | undefined) => (asset && rosterSet.has(asset.id) ? 1 : 0)

  const D = drivers.length
  const dPrice = new Int32Array(D)
  const dProj = new Float64Array(D)
  const dInRoster = new Uint8Array(D)
  for (let i = 0; i < D; i++) {
    const d = drivers[i]
    if (!d) continue
    dPrice[i] = d.priceTenths
    dProj[i] = d.projected
    dInRoster[i] = inRoster(d)
  }
  // Prefix sums over ascending prices: the cheapest `need` drivers from index
  // `start` onward cost dPrefix[start + need] - dPrefix[start].
  const dPrefix = new Int32Array(D + 1)
  for (let i = 0; i < D; i++) dPrefix[i + 1] = (dPrefix[i] ?? 0) + (dPrice[i] ?? 0)

  // Every constructor pair, sorted ascending by combined price.
  const pairs: { i: number; j: number; price: number }[] = []
  for (let i = 0; i < constructors.length; i++) {
    for (let j = i + 1; j < constructors.length; j++) {
      const price = (constructors[i]?.priceTenths ?? 0) + (constructors[j]?.priceTenths ?? 0)
      pairs.push({ i, j, price })
    }
  }
  pairs.sort((x, y) => x.price - y.price)

  const pairCount = pairs.length
  const pairPrice = new Int32Array(pairCount)
  const pairProj = new Float64Array(pairCount)
  const pairTransfers = new Int32Array(pairCount)
  const pairI = new Int32Array(pairCount)
  const pairJ = new Int32Array(pairCount)
  // A plain loop, not forEach: a closure capturing these arrays makes V8
  // context-allocate them, and the hot loop reads them ~1.45M times (a forEach
  // here measured ~15% slower in pnpm bench).
  for (const [k, { i, j, price }] of pairs.entries()) {
    const ci = constructors[i]
    const cj = constructors[j]
    pairPrice[k] = price
    pairProj[k] = (ci?.projected ?? 0) + (cj?.projected ?? 0)
    pairTransfers[k] = 2 - inRoster(ci) - inRoster(cj)
    pairI[k] = i
    pairJ[k] = j
  }
  const minPairPrice = pairPrice[0] ?? 0

  // ---- accumulators --------------------------------------------------------
  // Global best compares penalty-folded score; buckets compare raw points
  // (the penalty is constant within a bucket, so the ranking is identical).
  const globalBest = emptyScratch()
  let globalBestScore = Number.NEGATIVE_INFINITY
  const buckets: Scratch[] = Array.from({ length: MAX_TRANSFERS + 1 }, emptyScratch)

  const penaltyFor = (transfers: number): number => {
    const excess = Math.max(0, transfers - freeTransfers)
    // A literal 0 within the allowance: the negative penalty × 0 would be -0.
    return excess > 0 ? EXTRA_TRANSFER_PENALTY * excess : 0
  }

  /** Canonical team identity (sorted ids per class) — the final tie-break. */
  function teamKey(s: Scratch): string {
    const ids = [
      drivers[s.d0]?.id ?? "",
      drivers[s.d1]?.id ?? "",
      drivers[s.d2]?.id ?? "",
      drivers[s.d3]?.id ?? "",
      drivers[s.d4]?.id ?? "",
    ].sort()
    const cons = [
      constructors[pairI[s.pair] ?? 0]?.id ?? "",
      constructors[pairJ[s.pair] ?? 0]?.id ?? "",
    ].sort()
    return `${ids.join(",")}|${cons.join(",")}`
  }

  /**
   * Whether `candidate` displaces `incumbent`: higher key (keyDelta > 0), then
   * lower cost, then the lexicographically smaller teamKey. A total order, so
   * the winner never depends on enumeration order.
   */
  function challenge(incumbent: Scratch, candidate: Scratch, keyDelta: number): boolean {
    if (!incumbent.occupied) return true
    if (keyDelta !== 0) return keyDelta > 0
    if (candidate.costTenths !== incumbent.costTenths) {
      return candidate.costTenths < incumbent.costTenths
    }
    return teamKey(candidate) < teamKey(incumbent)
  }

  // Fast-path thresholds: the hot loop only takes the slow (tie-break) path
  // when a candidate matches or beats these — rare, so the per-leaf cost is a
  // few float ops. bucketRaw mirrors buckets[t].projectedTotal.
  const bucketRaw = new Float64Array(MAX_TRANSFERS + 1).fill(Number.NEGATIVE_INFINITY)
  // Penalty by transfer count, precomputed (avoids Math.max per leaf).
  const penaltyByT = new Float64Array(MAX_TRANSFERS + 1)
  for (let t = 0; t <= MAX_TRANSFERS; t++) penaltyByT[t] = penaltyFor(t)

  const candidate = emptyScratch()

  /** Slow path: offer one squad to the global and per-bucket incumbents. */
  function record(
    d0: number,
    d1: number,
    d2: number,
    d3: number,
    d4: number,
    pair: number,
    costTenths: number,
    projectedTotal: number,
    transfers: number,
    score: number
  ): void {
    candidate.occupied = true
    candidate.d0 = d0
    candidate.d1 = d1
    candidate.d2 = d2
    candidate.d3 = d3
    candidate.d4 = d4
    candidate.pair = pair
    candidate.costTenths = costTenths
    candidate.projectedTotal = projectedTotal
    candidate.transfers = transfers

    if (score >= globalBestScore && challenge(globalBest, candidate, score - globalBestScore)) {
      Object.assign(globalBest, candidate)
      globalBestScore = score
    }
    const bucket = buckets[transfers]
    if (bucket && challenge(bucket, candidate, candidate.projectedTotal - bucket.projectedTotal)) {
      Object.assign(bucket, candidate)
      bucketRaw[transfers] = projectedTotal
    }
  }

  // ---- enumeration ----------------------------------------------------------
  const captainFactor = DRS_BOOST_MULTIPLIER - 1

  // cheapestNext(start, n): sum of the n cheapest drivers at index ≥ start.
  const cheapestNext = (start: number, n: number): number =>
    start + n <= D ? (dPrefix[start + n] ?? 0) - (dPrefix[start] ?? 0) : Number.MAX_SAFE_INTEGER

  for (let a = 0; a <= D - 5; a++) {
    const priceA = dPrice[a] ?? 0
    if (budgetEnforced && priceA + cheapestNext(a + 1, 4) + minPairPrice > purseTenths) break
    const projA = dProj[a] ?? 0
    const capA = projA
    const trA = 1 - (dInRoster[a] ?? 0)

    for (let b = a + 1; b <= D - 4; b++) {
      const priceB = priceA + (dPrice[b] ?? 0)
      if (budgetEnforced && priceB + cheapestNext(b + 1, 3) + minPairPrice > purseTenths) break
      const projB = projA + (dProj[b] ?? 0)
      const capB = Math.max(capA, dProj[b] ?? 0)
      const trB = trA + 1 - (dInRoster[b] ?? 0)

      for (let c = b + 1; c <= D - 3; c++) {
        const priceC = priceB + (dPrice[c] ?? 0)
        if (budgetEnforced && priceC + cheapestNext(c + 1, 2) + minPairPrice > purseTenths) break
        const projC = projB + (dProj[c] ?? 0)
        const capC = Math.max(capB, dProj[c] ?? 0)
        const trC = trB + 1 - (dInRoster[c] ?? 0)

        for (let d = c + 1; d <= D - 2; d++) {
          const priceD = priceC + (dPrice[d] ?? 0)
          if (budgetEnforced && priceD + cheapestNext(d + 1, 1) + minPairPrice > purseTenths) break
          const projD = projC + (dProj[d] ?? 0)
          const capD = Math.max(capC, dProj[d] ?? 0)
          const trD = trC + 1 - (dInRoster[d] ?? 0)

          for (let e = d + 1; e <= D - 1; e++) {
            const priceE = priceD + (dPrice[e] ?? 0)
            if (budgetEnforced && priceE + minPairPrice > purseTenths) break
            const projE = projD + (dProj[e] ?? 0)
            const capE = Math.max(capD, dProj[e] ?? 0)
            const trE = trD + 1 - (dInRoster[e] ?? 0)

            const driverBudget = purseTenths - priceE
            const captainBonus = captainFactor * capE
            const baseProj = projE + captainBonus

            for (let p = 0; p < pairCount; p++) {
              const pp = pairPrice[p] ?? 0
              if (budgetEnforced && pp > driverBudget) break
              // Hot path: pure float compares; record() only on >= (rare).
              const transfers = trE + (pairTransfers[p] ?? 0)
              const raw = baseProj + (pairProj[p] ?? 0)
              const score = raw + (penaltyByT[transfers] ?? 0)
              if (score >= globalBestScore || raw >= (bucketRaw[transfers] ?? 0)) {
                record(a, b, c, d, e, p, priceE + pp, raw, transfers, score)
              }
            }
          }
        }
      }
    }
  }

  // ---- reconstruction -------------------------------------------------------
  function toPlan(s: Scratch): TeamPlan {
    const driverIdx = [s.d0, s.d1, s.d2, s.d3, s.d4]
    const teamDrivers = driverIdx.map((i) => drivers[i]).filter((x) => x !== undefined)
    const teamConstructors = [
      constructors[pairI[s.pair] ?? 0],
      constructors[pairJ[s.pair] ?? 0],
    ].filter((x) => x !== undefined)

    const captainId = pickDrsCaptainId(
      teamDrivers.map((d) => d.id),
      (id) => byId.get(id)?.projected ?? 0
    )

    const penaltyPoints = penaltyFor(s.transfers)
    return {
      driverIds: teamDrivers.map((d) => d.id).sort(),
      constructorIds: teamConstructors.map((c) => c.id).sort(),
      captainId: captainId ?? "",
      projectedTotal: s.projectedTotal,
      score: s.projectedTotal + penaltyPoints,
      transfers: s.transfers,
      penaltyPoints,
      costTenths: s.costTenths,
      budgetLeftTenths: purseTenths - s.costTenths,
    }
  }

  if (!globalBest.occupied) {
    // Unreachable for valid input: the roster itself always fits the purse
    // (purse = bank + roster cost). Kept as a loud guard, not a silent null.
    throw new OptimizerInputError("no feasible team exists under the purse")
  }

  return {
    best: toPlan(globalBest),
    byTransferCount: buckets.map((b) => (b.occupied ? toPlan(b) : null)),
  }
}
