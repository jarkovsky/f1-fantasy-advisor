/**
 * The DRS Boost captain: the driver with the highest projection, ties broken by
 * the lower playerId. This MUST agree with the optimizer's own captain choice in
 * toPlan (optimize.ts) — the read-only views (locked, between-rounds) pick it
 * directly rather than re-running the search. drs-boost.test.ts pins that
 * agreement against a real optimize() run.
 */
export function pickDrsCaptainId(
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
