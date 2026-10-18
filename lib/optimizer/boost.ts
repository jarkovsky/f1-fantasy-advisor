/**
 * The x2 Boost driver: the driver with the highest projection, ties broken by
 * the lower playerId. optimize() picks its plan Boost drivers with this, and the
 * read-only views (locked, between-rounds) call it directly instead of
 * re-running the search, so every screen boosts the same driver.
 */
export function pickBoostDriverId(
  driverIds: readonly string[],
  projOf: (id: string) => number
): string | null {
  let best: string | null = null
  for (const id of driverIds) {
    if (best === null) {
      best = id
      continue
    }
    const delta = projOf(id) - projOf(best)
    if (delta > 0 || (delta === 0 && id < best)) best = id
  }
  return best
}
