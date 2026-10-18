import type { DriverProfile, SessionRating } from "./types/profile"
/**
 * Assembles every active driver's hero view model from the current feed + the
 * season history. Ratings and the season rank are relative to the grid, so
 * they are built for all drivers at once; the feed's inactive leftovers (a
 * driver's stale pre-swap entry) are not part of the grid. Pure: the server-only
 * headshot/car-number/logo lookup is injected.
 */
import type { SeasonHistory } from "@/lib/f1/types/history"
import type { Asset, Driver } from "@/lib/f1/schemas"
import type { TeamLogo } from "@/lib/asset-lite"

import { scoredPoints, sessionAvg } from "./season-stats"
import { type Ranked, rankIntoBands } from "./ratings"
import { selectionTrend } from "./sentiment"

export type DriverExtras = (driver: Driver) => {
  headshotPath: string | null
  carNumber: number | null
  teamLogo: TeamLogo | null
}

/** "Max Verstappen" → { first: "Max", last: "Verstappen" } (the last word is the surname). */
export function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim()
  const cut = trimmed.lastIndexOf(" ")
  if (cut === -1) return { first: "", last: trimmed }
  return { first: trimmed.slice(0, cut), last: trimmed.slice(cut + 1) }
}

function sessionRating(ranked: Ranked | undefined, avg: number | null): SessionRating | null {
  if (!ranked || avg === null) return null
  return { ...ranked, avg }
}

export function buildDriverProfiles(
  assets: readonly Asset[],
  history: SeasonHistory,
  extras: DriverExtras
): Record<string, DriverProfile> {
  const drivers = assets.filter((a): a is Driver => a.kind === "driver" && a.active)

  const qualiAvg: Record<string, number | null> = {}
  const raceAvg: Record<string, number | null> = {}
  const seasonPoints: Record<string, number | null> = {}
  for (const d of drivers) {
    const hist = history.byPlayerId[d.playerId]
    qualiAvg[d.playerId] = sessionAvg(hist, "Qualifying")
    raceAvg[d.playerId] = sessionAvg(hist, "Race")
    seasonPoints[d.playerId] = hist?.cumulativePoints ?? 0
  }
  const qualiRanks = rankIntoBands(qualiAvg)
  const raceRanks = rankIntoBands(raceAvg)
  const seasonRanks = rankIntoBands(seasonPoints)

  const out: Record<string, DriverProfile> = {}
  for (const d of drivers) {
    const hist = history.byPlayerId[d.playerId]
    const split = splitFullName(d.fullName)
    const { headshotPath, carNumber, teamLogo } = extras(d)
    out[d.playerId] = {
      playerId: d.playerId,
      firstName: d.firstName ?? split.first,
      lastName: d.lastName ?? split.last,
      tla: d.tla,
      teamName: d.teamName,
      constructorId: d.constructorId,
      birthplace: d.countryName,
      carNumber,
      headshotPath,
      teamLogo,
      priceTenths: d.priceTenths,
      seasonPriceDeltaTenths: hist?.priceDeltaTenths ?? 0,
      lastPriceDeltaTenths: d.priceTenths - d.prevPriceTenths,
      seasonPoints: seasonPoints[d.playerId] ?? 0,
      seasonRank: seasonRanks[d.playerId]?.rank ?? drivers.length,
      gridSize: drivers.length,
      scoredRaces: scoredPoints(hist).length,
      quali: sessionRating(qualiRanks[d.playerId], qualiAvg[d.playerId] ?? null),
      race: sessionRating(raceRanks[d.playerId], raceAvg[d.playerId] ?? null),
      sentiment: selectionTrend(hist?.perRace ?? []),
      boostedPercent: d.boostedPercent,
    }
  }
  return out
}
