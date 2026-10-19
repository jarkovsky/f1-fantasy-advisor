/**
 * The profile page's per-race tables: one driver's weekend-by-weekend points
 * split by session, and the teammate head-to-head. Pure — no I/O.
 */
import type { AssetHistory, AssetRacePoint } from "@/lib/f1/types/history"
import type { RaceWeekend, SessionLabelType } from "@/lib/f1/schemas"

export type RaceResultRow = {
  raceNumber: number
  /** Grand Prix name from the raceday schedule; null if the schedule lacks the race. */
  gpName: string | null
  /** Host country (raceday feed spelling), for the flag; null when unknown. */
  country: string | null
  priceTenths: number
  quali: number | null
  sprint: number | null
  race: number | null
  /** Whole-weekend fantasy points; null while the race week is pending. */
  total: number | null
}

function sessionTotal(point: AssetRacePoint, session: SessionLabelType): number | null {
  let total: number | null = null
  for (const sp of point.sessionPoints) {
    if (sp.session === session && sp.points !== null) total = (total ?? 0) + sp.points
  }
  return total
}

/** Most recent race first — the table reads like a results feed. */
export function raceResults(hist: AssetHistory, weekends: readonly RaceWeekend[]): RaceResultRow[] {
  const weekendByRace = new Map(weekends.map((w) => [w.raceNumber, w]))
  return hist.perRace
    .map((p) => ({
      raceNumber: p.raceNumber,
      gpName: weekendByRace.get(p.raceNumber)?.gpName ?? null,
      country: weekendByRace.get(p.raceNumber)?.country ?? null,
      priceTenths: p.priceTenths,
      quali: sessionTotal(p, "Qualifying"),
      sprint: sessionTotal(p, "Sprint Qualifying"),
      race: sessionTotal(p, "Race"),
      total: p.status === "scored" ? p.points : null,
    }))
    .reverse()
}

export type HeadToHead = {
  /** Races both drivers scored. */
  races: number
  /** Races this driver outscored the teammate. */
  ahead: number
  /** Races the teammate outscored this driver. */
  behind: number
}

/** Weekend-by-weekend fantasy points duel; equal scores count for neither side. */
export function headToHead(driver: AssetHistory, teammate: AssetHistory): HeadToHead {
  const theirs = new Map<number, number>()
  for (const p of teammate.perRace) {
    if (p.status === "scored" && p.points !== null) theirs.set(p.raceNumber, p.points)
  }
  let races = 0
  let ahead = 0
  let behind = 0
  for (const p of driver.perRace) {
    if (p.status !== "scored" || p.points === null) continue
    const other = theirs.get(p.raceNumber)
    if (other === undefined) continue
    races += 1
    if (p.points > other) ahead += 1
    else if (p.points < other) behind += 1
  }
  return { races, ahead, behind }
}
