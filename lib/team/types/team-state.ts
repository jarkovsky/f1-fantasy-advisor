/**
 * The persisted client team-state shape (localStorage key "f1:v1"). Versioned
 * so a future shape can migrate rather than crash. The store that reads, writes,
 * and validates it lives in ../store.ts.
 */

export type TeamStateV1 = {
  v: 1
  /** Exactly 7 ids when set: 5 drivers + 2 constructors. null = none picked. */
  roster: string[] | null
  /** Remaining bank, integer tenths-of-a-million. */
  budgetTenths: number
  freeTransfers: 2 | 3 | "unlimited"
  /** Race the team was entered for; null = first visit (never saved). */
  raceNumber: number | null
  activeChip: "none" | "wildcard" | "limitless"
  dismissedHonestyNote: boolean
  /** Stamped on save; powers "you scored X · we projected Y". */
  savedProjection: { totalPoints: number; preset: string } | null
}
