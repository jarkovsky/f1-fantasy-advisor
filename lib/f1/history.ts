/**
 * Pure season-history assembly across per-race payloads.
 *
 * Why this module exists: the feed's own season totals (`OverallPpints`,
 * `AdditionalStats`) are CONTAMINATED — old race files get regenerated, so a
 * race-4 file fetched today reports the race-5-era cumulative (verified live:
 * Gasly's race-4 file says 53 while the true sum through race 4 is 37). The
 * only reliable per-race series are the race points / session points /
 * prices, so the season cumulative is RECOMPUTED here by summing them.
 *
 * Pure function — no I/O, no caching. feed.ts wraps it (getHistory).
 */
import type { Asset, AssetAdditionalStats, SessionPoints } from "./schemas"

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
  /** RECOMPUTED: sum of scored per-race points (never the feed's total). */
  cumulativePoints: number
  /** Running sum over scored races — sparkline/series-ready. */
  cumulativeByRace: { raceNumber: number; cumulative: number }[]
  /** Latest price minus earliest price across present races. */
  priceDeltaTenths: number
  /** Season-to-date stat breakdown from the latest SCORED race — a snapshot
   *  of feed-generation time, never summed as a series. */
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

export function assembleHistory(payloads: RacePayload[]): SeasonHistory {
  const warnings: string[] = []

  const sorted = [...payloads].sort((a, b) => a.raceNumber - b.raceNumber)
  const seen = new Set<number>()
  const deduped = sorted.filter((p) => {
    if (seen.has(p.raceNumber)) {
      warnings.push(`duplicate race ${p.raceNumber} dropped`)
      return false
    }
    seen.add(p.raceNumber)
    return true
  })

  const byPlayerId: Record<string, AssetHistory> = {}
  let pendingRace: number | null = null

  for (const payload of deduped) {
    for (const asset of payload.assets) {
      const pending = asset.racePoints === null
      if (pending && payload.raceNumber !== pendingRace) {
        pendingRace = payload.raceNumber
      }

      const point: AssetRacePoint = {
        raceNumber: payload.raceNumber,
        priceTenths: asset.priceTenths,
        prevPriceTenths: asset.prevPriceTenths,
        points: asset.racePoints,
        sessionPoints: asset.sessionPoints,
        selectedPercent: asset.selectedPercent,
        status: pending ? "pending" : "scored",
      }

      const existing = byPlayerId[asset.playerId]
      if (existing) {
        existing.perRace.push(point)
        // Keep identity fields from the most recent race.
        existing.displayName = asset.displayName
        existing.teamName = asset.teamName
        if (!pending) existing.latestAdditionalStats = asset.additionalStats
      } else {
        byPlayerId[asset.playerId] = {
          playerId: asset.playerId,
          kind: asset.kind,
          displayName: asset.displayName,
          teamName: asset.teamName,
          perRace: [point],
          cumulativePoints: 0,
          cumulativeByRace: [],
          priceDeltaTenths: 0,
          latestAdditionalStats: pending ? null : asset.additionalStats,
        }
      }
    }
  }

  // Second pass: cumulatives, price deltas, chain sanity.
  for (const history of Object.values(byPlayerId)) {
    let cumulative = 0
    for (const point of history.perRace) {
      if (point.status === "scored" && point.points !== null) {
        cumulative += point.points
        history.cumulativeByRace.push({
          raceNumber: point.raceNumber,
          cumulative,
        })
      }
    }
    history.cumulativePoints = cumulative

    const first = history.perRace[0]
    const last = history.perRace[history.perRace.length - 1]
    history.priceDeltaTenths = first && last ? last.priceTenths - first.priceTenths : 0

    // Price-chain invariant: price[race] === prevPrice[race+1] for CONSECUTIVE
    // races (a gap from a mid-season swap legitimately breaks the chain).
    for (let i = 1; i < history.perRace.length; i++) {
      const prev = history.perRace[i - 1]
      const curr = history.perRace[i]
      if (!prev || !curr) continue
      if (curr.raceNumber === prev.raceNumber + 1 && curr.prevPriceTenths !== prev.priceTenths) {
        warnings.push(
          `price chain broken for ${history.playerId} at race ${curr.raceNumber}: ` +
            `${prev.priceTenths} → declared prev ${curr.prevPriceTenths}`
        )
      }
    }
  }

  return {
    byPlayerId,
    raceNumbers: deduped.map((p) => p.raceNumber),
    pendingRace,
    warnings,
  }
}
