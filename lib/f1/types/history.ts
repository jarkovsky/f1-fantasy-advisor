/**
 * Types for the assembled season history: per-asset series with recomputed
 * cumulatives. The assembly logic (and why the feed's own totals can't be
 * trusted) lives in ../history.ts.
 */
import type { Asset, AssetAdditionalStats, SessionPoints } from "../schemas"

export type RacePayload = {
  raceNumber: number
  assets: Asset[]
}

export type AssetRacePoint = {
  raceNumber: number
  priceTenths: number
  prevPriceTenths: number
  /** null ⇒ pending (pre-race current race week). */
  points: number | null
  sessionPoints: SessionPoints[]
  selectedPercent: number
  status: "scored" | "pending"
}

export type AssetHistory = {
  playerId: string
  kind: Asset["kind"]
  displayName: string
  teamName: string | null
  /** Ordered by raceNumber; only races where the asset was present. */
  perRace: AssetRacePoint[]
  /** Recomputed: sum of scored per-race points (never the feed's total). */
  cumulativePoints: number
  /** Running sum over scored races — sparkline/series-ready. */
  cumulativeByRace: { raceNumber: number; cumulative: number }[]
  /** Latest price minus earliest price across present races. */
  priceDeltaTenths: number
  /**
   * Season-to-date stat breakdown from the latest scored race — a snapshot as
   * of feed generation, never summed as a series.
   */
  latestAdditionalStats: AssetAdditionalStats | null
}

export type SeasonHistory = {
  /** Plain record (not a Map) so it can cross an RSC boundary if needed. */
  byPlayerId: Record<string, AssetHistory>
  /** Sorted race numbers included in this assembly. */
  raceNumbers: number[]
  /** The pre-race race week excluded from cumulatives, if any. */
  pendingRace: number | null
  /** Non-fatal data oddities (duplicate races, broken price chains). */
  warnings: string[]
}
