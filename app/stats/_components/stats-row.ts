/**
 * Plain JSON row shipped from the server fetcher (asset-table.tsx). No class
 * instances, no methods — fully serializable across the RSC ⇄ island boundary.
 * Nullable numerics (`form5`, the per-session averages, `ppm`) render an em
 * dash and always sort last.
 */
export type StatsRow = {
  playerId: string
  kind: "driver" | "constructor"
  displayName: string
  tla: string
  teamName: string | null
  /** team-colors join key (assetColorKey) — drives the decorative bar only. */
  colorKey: string | null
  priceTenths: number
  priceDeltaTenths: number
  seasonPoints: number
  ppm: number | null
  form5: number | null
  qualiAvg: number | null
  raceAvg: number | null
  sprintAvg: number | null
  selectedPercent: number
  captainSelectedPercent: number
  spark: number[]
}
