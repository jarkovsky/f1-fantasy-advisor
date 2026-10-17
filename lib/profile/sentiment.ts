/**
 * Sentiment from the crowd's selection trend: the change in selection % over
 * the last SENTIMENT_WINDOW races, read from the per-race history (the
 * pending current race carries today's selection, so it counts).
 */
import type { AssetRacePoint } from "@/lib/f1/types/history"
import type { SelectionTrend } from "./types/profile"

import { SENTIMENT_FULL_SCALE, SENTIMENT_WINDOW } from "@/lib/constants"

export function selectionTrend(perRace: readonly AssetRacePoint[]): SelectionTrend {
  const latest = perRace.at(-1)
  if (!latest) return { selectedPercent: 0, change: null, races: 0 }
  if (perRace.length < 2) {
    return { selectedPercent: latest.selectedPercent, change: null, races: 0 }
  }
  // Compare with the entry SENTIMENT_WINDOW races back, or the earliest one.
  const baseIndex = Math.max(0, perRace.length - 1 - SENTIMENT_WINDOW)
  const base = perRace[baseIndex] as AssetRacePoint
  return {
    selectedPercent: latest.selectedPercent,
    change: latest.selectedPercent - base.selectedPercent,
    races: perRace.length - 1 - baseIndex,
  }
}

/**
 * Needle position for the sentiment meter, −1 (fully bearish) … +1 (fully
 * bullish); 0 for no change or no data.
 */
export function sentimentPosition(change: number | null): number {
  if (change === null) return 0
  return Math.max(-1, Math.min(1, change / SENTIMENT_FULL_SCALE))
}
