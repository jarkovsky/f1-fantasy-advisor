/**
 * Dev-only wall-clock with a browser override.
 *
 * In development the clock can be forced via `localStorage["f1:devNow"]` so a
 * tester can drive the race-week machine into LOCKED / BETWEEN_ROUNDS /
 * SEASON_ENDED without waiting for real time. The override accepts either an
 * epoch-ms integer string or an ISO date string; anything unparseable is
 * ignored and the real clock wins.
 *
 * The `process.env.NODE_ENV !== "production"` guard makes the override branch
 * DEAD CODE in production bundles — verified at the milestone gate by grepping
 * the client chunks for `devNow` (it must not appear). The whole thing is
 * wrapped in try/catch so SSR (no `window`) and blocked storage are safe.
 */
export function currentTimeMs(): number {
  if (process.env.NODE_ENV !== "production") {
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("f1:devNow")
          : null
      if (raw !== null) {
        const trimmed = raw.trim()
        // Pure-digit string → epoch ms.
        if (/^\d+$/.test(trimmed)) {
          const ms = Number(trimmed)
          if (Number.isFinite(ms)) return ms
        } else {
          // Otherwise try to parse it as an ISO date string.
          const ms = Date.parse(trimmed)
          if (Number.isFinite(ms)) return ms
        }
      }
    } catch {
      // SSR / blocked storage / bad value → fall through to the real clock.
    }
  }
  return Date.now()
}
