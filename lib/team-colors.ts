/**
 * Hand-curated decorative team palette.
 *
 * Keyed by constructor `playerId` — the stable join key. Drivers carry no own
 * color: they join via their `constructorId` field (= the constructor's
 * `playerId`), so one map serves both kinds.
 *
 * Decorative accents only (3px left-border bars / dots applied via inline
 * style). Never use these as text color or as the sole information carrier —
 * several hexes (e.g. Mercedes #27F4D2, Audi #52E252) would fail WCAG AA as
 * text on the dark surface. Ids verified against the 2026 grid; Cadillac's
 * color (#E80020) is provisional.
 */

export const TEAM_COLORS: Record<string, string> = {
  "27": "#FF8000", // McLaren
  "25": "#E8002D", // Ferrari
  "29": "#3671C6", // Red Bull Racing
  "28": "#27F4D2", // Mercedes
  "24": "#229971", // Aston Martin
  "23": "#0093CC", // Alpine
  "210": "#64C4FF", // Williams
  "2636": "#6692FF", // Racing Bulls
  "26": "#B6BABD", // Haas
  "2640": "#52E252", // Audi
  "2641": "#E80020", // Cadillac (provisional)
}

const NEUTRAL_ACCENT = "var(--grid-line-strong)"

/**
 * Resolve a constructor's decorative accent. Falls back to a neutral grid line
 * for unmapped / unknown ids so a new team never renders an empty accent.
 */
export function teamColor(constructorId: string | null | undefined): string {
  if (constructorId == null) return NEUTRAL_ACCENT
  return TEAM_COLORS[constructorId] ?? NEUTRAL_ACCENT
}
