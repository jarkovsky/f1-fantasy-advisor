/**
 * Display formatting for money / points / dates (spec §10).
 *
 * Extracted verbatim from the /stats asset table (the M1 exit surface) so the
 * advisor's <Delta> and the stats explorer share one source of truth. PURE:
 * no wall-clock reads, no locale dependence — every helper is unit-testable
 * and produces byte-identical output to the original inline code.
 *
 * Conventions, preserved exactly:
 *  - Money lives in integer tenths-of-a-million; price prints as `$X.XM`.
 *  - Signed deltas use U+2212 MINUS (−), not the hyphen-minus, and render a
 *    bare middle dot `·` for an exact zero (no value churn).
 *  - Absent points render as an em dash `—`.
 */

/** Integer tenths-of-a-million → `$26.5M` / `$30.0M` (always one decimal). */
export function formatPriceTenths(tenths: number): string {
  return `$${(tenths / 10).toFixed(1)}M`
}

/**
 * Signed price delta in tenths → `+0.3` / `−0.3` / `·` (zero).
 * Magnitude is plain division (no fixed decimals): 3 → 0.3, 10 → 1, 5 → 0.5.
 */
export function formatDeltaTenths(delta: number): string {
  if (delta === 0) return "·"
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta) / 10}`
}

/** Race points → the bare number, or `—` when not yet scored (null). */
export function formatPoints(p: number | null): string {
  return p == null ? "—" : String(p)
}

/** Signed points (advisor <Delta>) → `+11` / `−8` / `·` (zero). */
export function formatSignedPoints(p: number): string {
  if (p === 0) return "·"
  return `${p > 0 ? "+" : "−"}${Math.abs(p)}`
}

/** Epoch ms → TZ-stable `YYYY-MM-DD` (UTC slice of the ISO string). */
export function formatDateISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
