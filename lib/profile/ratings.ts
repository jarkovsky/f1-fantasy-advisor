/**
 * Relative ratings for the hero's pip meters. A rating says where a driver
 * sits in this season's grid, not how good they are in absolute terms: rank
 * every driver by a value (higher is better) and split the ranks into
 * RATING_STEPS equal bands.
 */
import type { Rating } from "./types/profile"

import { RATING_STEPS } from "@/lib/constants"

export type Ranked = { rank: number; of: number; rating: Rating }

/**
 * Competition ranking ("1224"): a driver's rank is 1 + the number of strictly
 * better values, so ties share the better rank and band. Null values are
 * unranked and shrink the field (`of`) instead of sinking to the bottom.
 */
export function rankIntoBands(values: Record<string, number | null>): Record<string, Ranked> {
  const present = Object.entries(values).filter(
    (entry): entry is [string, number] => entry[1] !== null
  )
  const of = present.length
  const out: Record<string, Ranked> = {}
  for (const [id, value] of present) {
    const better = present.filter(([, v]) => v > value).length
    // better = 0 → top band (5); better = of − 1 → bottom band (1) once of ≥ 5.
    const band = RATING_STEPS - Math.floor((better * RATING_STEPS) / of)
    out[id] = { rank: better + 1, of, rating: band as Rating }
  }
  return out
}
