/**
 * Dev-only wall-clock with a browser override.
 *
 * In development the clock can be forced via `localStorage["f1:devNow"]` so a
 * tester can drive the race-week machine into LOCKED / BETWEEN_ROUNDS /
 * SEASON_ENDED without waiting for real time. The override accepts either an
 * epoch-ms integer string or an ISO date string; anything unparseable is
 * ignored and the real clock wins.
 *
 * The `process.env.NODE_ENV !== "production"` guard lets the bundler strip the
 * override branch from production builds (grep the client chunks for `devNow`
 * to confirm). The `window` check covers SSR; the try/catch covers blocked
 * storage, where getItem throws.
 */
export function currentTimeMs(): number {
  if (process.env.NODE_ENV !== "production") {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("f1:devNow") : null
      if (raw !== null) {
        const trimmed = raw.trim()
        const ms = /^\d+$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed)
        if (Number.isFinite(ms)) return ms
      }
    } catch {
      // Blocked storage → fall through to the real clock.
    }
  }
  return Date.now()
}
