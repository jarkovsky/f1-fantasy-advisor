/**
 * Result types for the projection engine (per-asset expected points under a
 * preset). The engine that produces these lives in ../engine.ts.
 */
import type { SessionLabelType } from "@/lib/f1/schemas"
import type { AssetHistory } from "@/lib/f1/types/history"

import type { PresetId } from "./presets"

export type ProjectionOptions = {
  preset: PresetId
  /** Custom blend only: 0 = pure Season average, 1 = pure Weighted recent. */
  blendWeight?: number
}

export type UpcomingWeekend = { isSprint: boolean }

export type SessionExpectation = {
  session: SessionLabelType
  expected: number
  /** Races where this session existed and was scored ("based on N" copy). */
  basisRaces: number
  /** True when E[sprint] used the scaled-prior small-sample guard. */
  priorBlended?: boolean
}

export type AssetProjection = {
  playerId: string
  kind: AssetHistory["kind"]
  totalPoints: number
  /** Empty for equal-ppm (direct total — no fake session split). */
  perSession: SessionExpectation[]
  /** The preset actually applied to this asset (fallbacks change it). */
  source: PresetId
  basis: { completedRaces: number; completedSprints: number }
  fallback?: "equal-ppm-no-history" | "equal-ppm-cold-start"
}

export type ProjectionResult = {
  byPlayerId: Record<string, AssetProjection>
  requestedPreset: PresetId
  /** Differs from requested only at cold start (equal-ppm forced). */
  effectivePreset: PresetId
  basis: { completedRaces: number; completedSprints: number }
  /** True at race 1: history presets greyed, equal-ppm locked (spec §6.2). */
  coldStart: boolean
  notes: string[]
}
