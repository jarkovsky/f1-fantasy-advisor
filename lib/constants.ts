/**
 * 2026 F1 Fantasy rule constants (spec §4.1, §7).
 *
 * All money values are integer tenths-of-a-million dollars: float sums of
 * 0.1s break exact budget-boundary comparisons in the optimizer (spec §7).
 */

/** Squad shape: 5 drivers + 2 constructors (2nd constructor new for 2026). */
export const SQUAD_DRIVERS = 5
export const SQUAD_CONSTRUCTORS = 2

/** 2026 grid: Cadillac + Audi joined. */
export const GRID = { drivers: 22, constructors: 11 } as const

/**
 * Free transfers per Grand Prix: 2, plus max 1 banked from last week → 2 or 3.
 * None carry over after a Wildcard/Limitless week.
 */
export const FREE_TRANSFERS = { min: 2, max: 3 } as const

/** Points penalty per transfer beyond the free allowance. */
export const EXTRA_TRANSFER_PENALTY = -10

/** Initial cost cap, in tenths of a million ($100.0M). Affordability is bank-based after race 1 (spec §7). */
export const INITIAL_BUDGET_TENTHS = 1000

/** DRS Boost: doubles one driver's race-weekend score, free every week. */
export const DRS_BOOST_MULTIPLIER = 2
