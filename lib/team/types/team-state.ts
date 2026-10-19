/**
 * The persisted client team-state shape (localStorage key "f1:v2"). Versioned
 * so a future shape can migrate rather than crash (v1 → v2 renamed two fields
 * to the official vocabulary; see migrate() in ../store.ts). The store that reads, writes,
 * and validates it lives in ../store.ts.
 */

export type TeamStateV2 = {
  v: 2
  /** Exactly 7 ids when set: 5 drivers + 2 constructors. null = none picked. */
  lineup: string[] | null
  /** Remaining Cost Cap (money not spent on the line-up), integer tenths-of-a-million. */
  remainingCostCapTenths: number
  freeTransfers: 2 | 3 | "unlimited"
  /** Race the team was entered for; null = first visit (never saved). */
  raceNumber: number | null
  activeChip: "none" | "wildcard" | "limitless"
  /** Stamped on save; powers "you scored X · we projected Y". */
  savedProjection: { totalPoints: number; preset: string } | null
}
