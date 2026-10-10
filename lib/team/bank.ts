/**
 * Parsing/formatting for the "remaining budget" bank input, shared by the team
 * picker and the rollover form. Money is integer tenths-of-a-million; a blank,
 * negative, or non-numeric field counts as "not yet entered".
 */

/** Parse a raw bank string. `entered` is false for blank/NaN/negative input. */
export function parseBank(input: string): { entered: boolean; tenths: number } {
  const trimmed = input.trim()
  const n = trimmed === "" ? null : Number(trimmed)
  const entered = n !== null && Number.isFinite(n) && n >= 0
  return { entered, tenths: entered ? Math.round(n * 10) : 0 }
}

/** Integer tenths → a one-decimal display string (e.g. 25 → "2.5"). */
export function formatBankTenths(tenths: number): string {
  return (tenths / 10).toFixed(1)
}
