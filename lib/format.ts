/**
 * Display formatting for money / points / ranks, shared by the advisor and the
 * /stats explorer. No wall-clock reads and no locale dependence, so server and
 * client render identical strings.
 *
 * Conventions:
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

/**
 * Signed points (advisor <Delta>) → `+11` / `−8` / `+18.4` / `·` (zero).
 * Projections are floats — round to one decimal first (the timing-screen
 * precision), then test for zero so `+0.04` collapses to `·`, not `+0.0`.
 * Integer magnitudes stay bare (`+11`, never `+11.0`).
 */
export function formatSignedPoints(p: number): string {
  const rounded = Math.round(p * 10) / 10
  if (rounded === 0) return "·"
  const magnitude = Math.abs(rounded)
  return `${rounded > 0 ? "+" : "−"}${magnitude}`
}

/** 1 → `1st`, 2 → `2nd`, 11 → `11th`, 22 → `22nd` (English ordinal suffixes). */
export function formatOrdinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix}`
}
