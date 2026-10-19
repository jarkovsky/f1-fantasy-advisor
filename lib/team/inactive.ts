/**
 * Inactive assets are the feed's stale leftovers: when a driver changes seat
 * mid-season, the old entry stays in the feed (IsActive "0") beside the new
 * one. They can't be bought, so they leave the grid, unless the saved line-up
 * still holds one. A held one keeps its feed price, so selling it frees what
 * the game refunds, but it projects 0 points: that entry no longer races.
 * Pure; the advisor runs it before the optimizer and the team comparison.
 */
import type { AssetLite } from "@/lib/asset-lite"

export function retireInactive(
  assets: AssetLite[],
  totals: Record<string, number>,
  lineup: readonly string[] | null
): { assets: AssetLite[]; totals: Record<string, number> } {
  const inactive = assets.filter((a) => !a.active)
  // The common case: nothing to retire, so keep both references stable.
  if (inactive.length === 0) return { assets, totals }

  const held = new Set(lineup ?? [])
  const retired = { ...totals }
  for (const a of inactive) retired[a.playerId] = 0
  return {
    assets: assets.filter((a) => a.active || held.has(a.playerId)),
    totals: retired,
  }
}
