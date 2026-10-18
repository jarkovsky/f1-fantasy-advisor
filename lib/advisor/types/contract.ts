/**
 * The server → advisor-island contract. Everything here crosses the RSC
 * boundary as props, so it must stay JSON-primitive: no Dates, no Maps, no
 * class instances, no functions.
 *
 * Design decisions this file encodes:
 * - The race-week state machine runs client-side: the server ships the
 *   serializable ingredients only. `now` and `storedRaceNumber` never
 *   appear here — baking either into the prerendered shell would freeze
 *   time at build or leak per-user state into shared HTML.
 * - `SeasonHistory` is never serialized. The server pre-computes every
 *   concrete preset; `custom-blend` is derived client-side by linear
 *   interpolation between `season-average` and `weighted-recent` — exact,
 *   not approximate (pinned by the blend-linearity test in
 *   lib/advisor/projection-resolve.test.ts).
 */
import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { RaceWeekConstraints, RaceWeekend } from "@/lib/f1/schemas"
import type { ConcretePresetId } from "@/lib/projections/types/presets"
import type { DriverProfile } from "@/lib/profile/types/profile"
import type { DataSource } from "@/lib/f1/types/feed"
import type { AssetLite } from "@/lib/asset-lite"

export type FeedProvenance = {
  source: DataSource
  asOf: string
}

/** Wildcard / Limitless what-if toggles: the plan is a hypothetical, never applied. */
export type WhatIfMode = "none" | "wildcard" | "limitless"

export type AdvisorServerProps = {
  /** Race-week state-machine inputs; the island runs deriveRaceWeekState itself. */
  constraints: RaceWeekConstraints
  raceWeekends: RaceWeekend[]
  live: boolean
  /** The full current-race grid, trimmed for the wire (see AssetLite). */
  assets: AssetLite[]
  /** Server-computed projections for every concrete preset. */
  projectionsByPreset: Record<ConcretePresetId, ProjectionResult>
  /**
   * Hero view model per driver. The hero follows the Boost pick, which is
   * only known once the client-side optimizer runs, so every driver ships.
   */
  driverProfiles: Record<string, DriverProfile>
  /** Actual points for the last completed race (LOCKED / BETWEEN_ROUNDS). */
  lastRacePoints: Record<string, number | null>
  /** Worst-of provenance across the feeds this page consumed. */
  meta: FeedProvenance
}
