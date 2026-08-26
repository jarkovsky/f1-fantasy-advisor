/**
 * The serializable, trimmed asset shape shared across the RSC ⇄ client island
 * boundary. The full domain Asset (lib/f1/schemas.ts) carries sessionPoints and
 * additionalStats the picker never needs — shipping them would bloat every
 * island payload. AssetLite is the lean projection: only the fields the picker
 * and advisor render, plus the precomputed cumulative seasonPoints (the feed's
 * own totals are contaminated; history.ts recomputes them) and a resolved
 * headshot path (null → the card renders a monogram avatar instead).
 *
 * PURE shape + one pure join helper. No I/O, no wall-clock — safe to import
 * from a server RSC or a "use client" island alike.
 */

export type AssetLite = {
  playerId: string
  kind: "driver" | "constructor"
  displayName: string
  fullName: string
  tla: string
  priceTenths: number
  prevPriceTenths: number
  selectedPercent: number
  captainSelectedPercent: number
  /** Driver's team id (= the constructor's playerId); null for constructors. */
  constructorId: string | null
  teamName: string | null
  /** Recomputed cumulative season points (history.ts), NOT the feed total. */
  seasonPoints: number
  /** `/headshots/{playerId}.png` when bundled, else null → monogram fallback. */
  headshotPath: string | null
}

/**
 * The team-color join key (lib/team-colors.ts is keyed by constructor playerId):
 * a constructor joins on its OWN playerId, a driver on its constructorId. Either
 * can be missing (a brand-new driver before the team link lands) → null, which
 * teamColor() resolves to the neutral grid line.
 */
export function assetColorKey(
  a: Pick<AssetLite, "kind" | "playerId" | "constructorId">
): string | null {
  return a.kind === "constructor" ? a.playerId : a.constructorId
}
