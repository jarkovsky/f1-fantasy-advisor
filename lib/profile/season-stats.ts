/**
 * Per-asset season summaries over the recomputed history: the /stats columns
 * and the driver profile hero both read these, so they agree to the decimal.
 * Pure — no I/O.
 */
import type { AssetHistory } from "@/lib/f1/types/history"
import type { SessionLabelType } from "@/lib/f1/schemas"

import { FORM_WINDOW } from "@/lib/constants"

/** Points of every scored race, in race order. */
export function scoredPoints(hist: AssetHistory | undefined): number[] {
  if (!hist) return []
  const out: number[] = []
  for (const p of hist.perRace) {
    if (p.status === "scored" && p.points !== null) out.push(p.points)
  }
  return out
}

/** Mean of the last ≤FORM_WINDOW scored per-race points; null when the asset has none. */
export function form5(hist: AssetHistory | undefined): number | null {
  const scored = scoredPoints(hist)
  if (scored.length === 0) return null
  const last = scored.slice(-FORM_WINDOW)
  return last.reduce((a, b) => a + b, 0) / last.length
}

/**
 * Mean of one session's points over the scored races where that session ran;
 * null when the session never occurred (e.g. Sprint Qualifying on a non-sprint
 * calendar, or pre-first-scored-race). A session present but null-pointed (pre-
 * race) is excluded by the scored filter.
 */
export function sessionAvg(
  hist: AssetHistory | undefined,
  session: SessionLabelType
): number | null {
  if (!hist) return null
  const values: number[] = []
  for (const race of hist.perRace) {
    if (race.status !== "scored") continue
    for (const sp of race.sessionPoints) {
      if (sp.session === session && sp.points !== null) values.push(sp.points)
    }
  }
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
