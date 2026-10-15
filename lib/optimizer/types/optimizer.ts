/**
 * Public types for the exact-search transfer optimizer. The search itself (and
 * the OptimizerInputError thrown on malformed input) lives in ../optimize.ts;
 * the feed→grid adapter in ../adapter.ts.
 */

export type OptimizerAsset = {
  id: string
  kind: "driver" | "constructor"
  /** Integer tenths-of-a-million. */
  priceTenths: number
  /** Expected fantasy points for the upcoming race (float). */
  projected: number
}

export type OptimizerMode = "normal" | "wildcard" | "limitless"

export type OptimizerInput = {
  assets: OptimizerAsset[]
  /** The current squad: exactly 5 driver ids + 2 constructor ids. */
  roster: string[]
  /** Remaining bank, integer tenths. */
  budgetTenths: number
  freeTransfers: number | "unlimited"
  mode?: OptimizerMode
}

export type TeamPlan = {
  driverIds: string[]
  constructorIds: string[]
  /** The DRS-boosted driver (max projection; ties → lower id). */
  captainId: string
  /** Raw points including the DRS Boost bonus, before any transfer penalty. */
  projectedTotal: number
  /** projectedTotal + penaltyPoints. */
  score: number
  /** Net swaps vs the roster, 0..7. */
  transfers: number
  /** EXTRA_TRANSFER_PENALTY · max(0, transfers − freeTransfers); 0 when unlimited. */
  penaltyPoints: number
  costTenths: number
  /** purse − cost; negative when a limitless-mode squad overspends. */
  budgetLeftTenths: number
}

export type OptimizerResult = {
  /** Global argmax of penalty-folded score. */
  best: TeamPlan
  /** [t] = best squad at exactly t net transfers (raw points), or null. */
  byTransferCount: (TeamPlan | null)[]
}
