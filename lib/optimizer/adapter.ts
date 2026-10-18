/**
 * Builds optimize()'s input from app data. Pure; runs client-side alongside
 * optimize(). Two responsibilities, kept apart on purpose:
 *
 *  1. toOptimizerAssets — field projection from the feed grid + a projections
 *     table. No filtering or rounding happens here.
 *  2. reconcileLineup — heals a saved lineup against the live grid, so a driver
 *     dropped mid-season can't make optimize() throw.
 */
import type { OptimizerAsset } from "./types/optimizer"

import { TEAM_DRIVERS } from "@/lib/constants"

/** Minimal asset shape the adapter needs — a structural subset of AssetLite. */
type GridAsset = {
  playerId: string
  kind: "driver" | "constructor"
  priceTenths: number
}

/**
 * Join the feed grid with a projections table (e.g. ProjectionResult mapped to
 * byPlayerId[id].totalPoints) into OptimizerAsset[].
 *
 * priceTenths passes through unchanged — never divide or round, optimize()
 * throws on non-integer money. A missing total degrades to 0 rather than
 * dropping the asset: dropping could shrink the grid below the 5-driver /
 * 2-constructor floor and make optimize() throw. Totals with no matching asset
 * are ignored, and input order is preserved.
 */
export function toOptimizerAssets<T extends GridAsset>(
  assets: readonly T[],
  totals: Record<string, number>
): OptimizerAsset[] {
  return assets.map((a) => ({
    id: a.playerId,
    kind: a.kind,
    priceTenths: a.priceTenths,
    projected: totals[a.playerId] ?? 0,
  }))
}

/**
 * Append a placeholder row for each saved lineup id missing from the grid, so
 * optimize() accepts the lineup ("lineup id not found" otherwise). The store
 * persists only ids, so a driver dropped mid-season leaves exactly this gap;
 * the UI renders "no longer available" tiles from the returned unresolvedIds.
 *
 * Placeholders project 0 points at price 0. The store keeps no last-known
 * price, and 0 understates the cost cap (Remaining Cost Cap + Σ lineup prices) rather than
 * overstating it, so every recommended team genuinely fits. Swapping a
 * placeholder out counts as a normal transfer.
 *
 * Kind is inferred by deficit: count the lineup ids that did resolve, then give
 * each missing id whichever class is short of its quota. For a well-formed 5+2
 * lineup the deficits sum to the number of unresolved ids. Missing ids are
 * filled drivers-first, which matches the store's lineup order (drivers, then
 * constructors).
 */
export function reconcileLineup(
  lineup: readonly string[],
  grid: readonly OptimizerAsset[]
): { assets: OptimizerAsset[]; unresolvedIds: string[] } {
  const byId = new Map(grid.map((a) => [a.id, a]))

  let resolvedDrivers = 0
  const unresolvedIds: string[] = []
  for (const id of lineup) {
    const asset = byId.get(id)
    if (!asset) unresolvedIds.push(id)
    else if (asset.kind === "driver") resolvedDrivers += 1
  }

  let driverDeficit = TEAM_DRIVERS - resolvedDrivers
  const assets = [...grid]
  for (const id of unresolvedIds) {
    const kind: OptimizerAsset["kind"] = driverDeficit > 0 ? "driver" : "constructor"
    if (kind === "driver") driverDeficit -= 1
    assets.push({ id, kind, priceTenths: 0, projected: 0 })
  }

  return { assets, unresolvedIds }
}
