/**
 * The server → advisor-island contract. Everything here crosses the RSC
 * boundary as props, so it must stay JSON-primitive: no Dates, no Maps, no
 * class instances, no functions.
 *
 * Design decisions this file encodes (plan D1/D3):
 * - The race-week state machine runs CLIENT-side: the server ships the
 *   serializable ingredients only. `now` and `storedRaceNumber` never
 *   appear here — baking either into the prerendered shell would freeze
 *   time at build or leak per-user state into shared HTML.
 * - `SeasonHistory` is never serialized. The server pre-computes every
 *   CONCRETE preset; `custom-blend` is derived client-side by linear
 *   interpolation between `season-average` and `weighted-recent` — exact,
 *   not approximate (pinned by the blend-linearity test in
 *   lib/projections.test.ts).
 */
import type { AssetLite } from "@/lib/asset-lite"
import type { RaceWeekConstraints, RaceWeekend } from "@/lib/f1/schemas"
import type { ConcretePresetId } from "@/lib/projections/types/presets"
import type { ProjectionResult } from "@/lib/projections/types/projection"

export type FeedProvenance = {
  source: "live" | "snapshot"
  asOf: string
}

/** Wildcard / Limitless what-if toggles (§4.3 — hypotheticals, never advice). */
export type WhatIfMode = "none" | "wildcard" | "limitless"

export type AdvisorServerProps = {
  /** State-machine ingredients (the island derives the §5.4 state itself). */
  constraints: RaceWeekConstraints
  raceWeekends: RaceWeekend[]
  nextRacePublished: boolean
  live: boolean
  /** The full current-race grid, trimmed for the wire (see AssetLite). */
  assets: AssetLite[]
  /** Server-computed projections for every concrete preset. */
  projectionsByPreset: Record<ConcretePresetId, ProjectionResult>
  /** Actual points for the last completed race (LOCKED / BETWEEN_ROUNDS). */
  lastRacePoints: Record<string, number | null>
  /** Worst-of provenance across the feeds this page consumed. */
  meta: FeedProvenance
}
