/**
 * The serializable, trimmed asset shape shared across the RSC ⇄ client island
 * boundary. The full domain Asset (lib/f1/schemas.ts) carries sessionPoints and
 * additionalStats the picker never needs — shipping them would bloat every
 * island payload. AssetLite is the lean projection: only the fields the picker
 * and advisor render, plus the precomputed cumulative seasonPoints (the feed's
 * own totals are contaminated; history.ts recomputes them) and a resolved
 * headshot path (null → the card renders a monogram avatar instead).
 *
 * A type plus one pure helper, with no I/O — safe to import from a server RSC
 * or a "use client" island alike.
 */

/** A team's two logo marks: full color for light surfaces, white for carbon ones. */
export type TeamLogo = { color: string; white: string }

export type AssetLite = {
  playerId: string
  kind: "driver" | "constructor"
  displayName: string
  fullName: string
  tla: string
  priceTenths: number
  prevPriceTenths: number
  selectedPercent: number
  boostedPercent: number
  /** Driver's team id (= the constructor's playerId); null for constructors. */
  constructorId: string | null
  teamName: string | null
  /** Recomputed cumulative season points (history.ts), not the feed total. */
  seasonPoints: number
  /** `/headshots/{playerId}.{ext}` when bundled, else null → monogram fallback. */
  headshotPath: string | null
  /** The team's logo (a constructor's own, a driver's constructor's); null → monogram. */
  logo: TeamLogo | null
  /**
   * false for the feed's stale leftovers (e.g. a driver's old team entry after
   * a seat swap): never offered for picking, and worth 0 points to a team that
   * still holds one (lib/team/inactive.ts).
   */
  active: boolean
}

/**
 * The team-color join key (lib/team-colors.ts is keyed by constructor playerId):
 * a constructor joins on its own playerId, a driver on its constructorId. A
 * driver's constructorId can be null (a brand-new driver before the team link
 * lands), which teamColor() resolves to the neutral grid line.
 */
export function assetColorKey(
  a: Pick<AssetLite, "kind" | "playerId" | "constructorId">
): string | null {
  return a.kind === "constructor" ? a.playerId : a.constructorId
}
