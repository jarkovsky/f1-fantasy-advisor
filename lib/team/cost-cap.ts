/**
 * Parsing/formatting for the Remaining Cost Cap input, shared by the team
 * picker and the rollover form. Money is integer tenths-of-a-million; a blank,
 * negative, or non-numeric field counts as "not yet entered".
 */

/** Parse a raw Remaining Cost Cap string. `entered` is false for blank/NaN/negative input. */
export function parseCostCap(input: string): { entered: boolean; tenths: number } {
  const trimmed = input.trim()
  const n = trimmed === "" ? null : Number(trimmed)
  const entered = n !== null && Number.isFinite(n) && n >= 0
  return { entered, tenths: entered ? Math.round(n * 10) : 0 }
}

/** Integer tenths → a one-decimal display string (e.g. 25 → "2.5"). */
export function formatCostCapTenths(tenths: number): string {
  return (tenths / 10).toFixed(1)
}
