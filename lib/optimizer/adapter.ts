/**
 * Adapter seam: joins the feed asset grid + a projections table into the
 * OptimizerAsset[] shape optimize() consumes (documented in optimizer.ts's
 * header). PURE: no I/O; runs client-side in M3 alongside optimize().
 *
 * Two responsibilities, kept apart on purpose:
 *
 *  1. toOptimizerAssets — field projection only. playerId→id, kind and
 *     priceTenths pass through UNCHANGED (never divide/round: optimize()
 *     throws on non-integer money). Projected points come from the totals
 *     table; a MISSING total degrades to 0 rather than dropping the asset —
 *     dropping could shrink the grid below the optimizer's 5-driver /
 *     2-constructor floor and make optimize() throw. Input order is preserved
 *     (optimize() sorts internally, but a stable seam is easier to reason
 *     about); totals keys with no matching asset are ignored (no phantoms).
 *
 *  2. reconcileRoster — heals a saved roster against the live grid. The store
 *     persists only ids, so a driver dropped mid-season leaves a roster id
 *     with no grid row, which optimize() rejects ("roster id not found"). We
 *     append a placeholder row per missing id so optimize() runs; the UI
 *     renders "no longer available — replace to continue" tiles from the
 *     returned unresolvedIds. Replacing a placeholder still costs a transfer,
 *     which falls out naturally: the placeholder id is in no candidate team
 *     the optimizer can field (it is never cheap-and-good enough to keep), so
 *     every emitted team drops it and counts the swap.
 */
import { SQUAD_CONSTRUCTORS, SQUAD_DRIVERS } from "@/lib/constants"
import type { OptimizerAsset } from "./types/optimizer"

/** Minimal asset shape the adapter needs — a structural subset of domain Asset. */
type GridAsset = {
  playerId: string
  kind: "driver" | "constructor"
  priceTenths: number
}

/**
 * Join the feed grid with a projections table (e.g. ProjectionResult mapped to
 * byPlayerId[id].totalPoints) into OptimizerAsset[]. Missing total → 0, asset
 * always kept; phantom totals (no matching asset) ignored; order preserved.
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
 * Augment the grid with placeholder rows for saved roster ids absent from it,
 * so optimize() never throws on a dropped-driver roster.
 *
 * Placeholder price is 0 (conservative): the store keeps no last-known price,
 * and 0 UNDERSTATES the purse (purse = bank + Σ roster prices), never
 * overstates it — the optimizer can only recommend teams that genuinely fit.
 * Kind is inferred by deficit: count the roster ids that DID resolve, then
 * fill each missing id with whichever class is short of its squad quota
 * (5 drivers, 2 constructors). With a well-formed 5+2 roster the deficits sum
 * to exactly the number of unresolved ids, so the assignment is unambiguous.
 */
export function reconcileRoster(
  roster: readonly string[],
  grid: readonly OptimizerAsset[]
): { assets: OptimizerAsset[]; unresolvedIds: string[] } {
  const byId = new Map(grid.map((a) => [a.id, a]))

  let resolvedDrivers = 0
  let resolvedConstructors = 0
  const unresolvedIds: string[] = []
  for (const id of roster) {
    const asset = byId.get(id)
    if (!asset) {
      unresolvedIds.push(id)
      continue
    }
    if (asset.kind === "driver") resolvedDrivers += 1
    else resolvedConstructors += 1
  }

  // Remaining slots per class drive the kind inference for placeholders.
  let driverDeficit = SQUAD_DRIVERS - resolvedDrivers
  let constructorDeficit = SQUAD_CONSTRUCTORS - resolvedConstructors

  const assets = [...grid]
  for (const id of unresolvedIds) {
    const kind: OptimizerAsset["kind"] = driverDeficit > 0 ? "driver" : "constructor"
    if (kind === "driver") driverDeficit -= 1
    else constructorDeficit -= 1
    assets.push({ id, kind, priceTenths: 0, projected: 0 })
  }
  void constructorDeficit // documented: both deficits reach 0 for a 5+2 roster

  return { assets, unresolvedIds }
}
