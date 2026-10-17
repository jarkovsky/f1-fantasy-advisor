/**
 * 2026 F1 Fantasy rule constants.
 *
 * All money values are integer tenths-of-a-million dollars: float sums of
 * 0.1s break exact budget-boundary comparisons in the optimizer.
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

/** Initial cost cap, in tenths of a million ($100.0M). Affordability is bank-based after race 1. */
export const INITIAL_BUDGET_TENTHS = 1000

/** DRS Boost: doubles one driver's race-weekend score, free every week. */
export const DRS_BOOST_MULTIPLIER = 2

// ---------------------------------------------------------------------------
// Projection model tuning. These live here (model axis), not in
// lib/f1/config.ts (vendor-feed axis).
// ---------------------------------------------------------------------------

/** "Weighted recent": weight halves every N races (effective window ≈ 5). */
export const EWMA_HALF_LIFE = 3

/** "Form (last 5)": plain mean over the last N completed races. */
export const FORM_WINDOW = 5

/** Sprint small-sample guard: α = n_sprints / (n_sprints + K). */
export const SPRINT_PRIOR_SHRINKAGE_K = 2

/** History presets are greyed below this many completed races (cold start). */
export const HISTORY_PRESET_MIN_RACES = 1

// ---------------------------------------------------------------------------
// Driver profile hero. Display-only summaries; nothing here feeds the optimizer.
// ---------------------------------------------------------------------------

/** Quali/Race ratings: the grid is split into this many equal bands (5 pips). */
export const RATING_STEPS = 5

/** Sentiment: change in selection % over the last N races. */
export const SENTIMENT_WINDOW = 3

/** Sentiment meter: a change of ±N selection-% points pins the needle to the end. */
export const SENTIMENT_FULL_SCALE = 10
