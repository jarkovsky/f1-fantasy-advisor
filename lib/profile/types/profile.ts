/**
 * The driver profile hero's view model. JSON-primitive throughout: the advisor
 * ships one per driver across the RSC ⇄ island boundary (the hero follows the
 * client-side Boost pick), and the /drivers/[playerId] page renders it on
 * the server.
 */
import type { TeamLogo } from "@/lib/asset-lite"

/** 1 = bottom band of the grid … 5 = top band (RATING_STEPS bands). */
export type Rating = 1 | 2 | 3 | 4 | 5

export type SessionRating = {
  rating: Rating
  /** 1-based rank among drivers who scored in this session (ties share a rank). */
  rank: number
  of: number
  /** Mean fantasy points per scored session. */
  avg: number
}

/**
 * Sentiment = the crowd's selection trend: how many selection-% points the
 * driver gained or shed over the last SENTIMENT_WINDOW races.
 */
export type SelectionTrend = {
  /** Current selection % (latest race in the feed). */
  selectedPercent: number
  /** Selection-% points gained (+) or shed (−); null with fewer than two races. */
  change: number | null
  /** Races the change spans (≤ SENTIMENT_WINDOW; 0 when change is null). */
  races: number
}

export type DriverProfile = {
  playerId: string
  firstName: string
  lastName: string
  tla: string
  teamName: string | null
  /** team-colors join key. */
  constructorId: string | null
  /** The feed's CountryName for a driver is a birthplace ("Hasselt, Belgium"). */
  birthplace: string | null
  /** Race number painted on the car (OpenF1); null when unmatched. */
  carNumber: number | null
  headshotPath: string | null
  teamLogo: TeamLogo | null
  priceTenths: number
  /** Latest price − first price this season. */
  seasonPriceDeltaTenths: number
  /** Latest price − the previous race's price. */
  lastPriceDeltaTenths: number
  /** Recomputed cumulative season points (history.ts). */
  seasonPoints: number
  /** 1-based rank among drivers by season points (ties share a rank). */
  seasonRank: number
  gridSize: number
  scoredRaces: number
  quali: SessionRating | null
  race: SessionRating | null
  sentiment: SelectionTrend
  boostedPercent: number
}
