/**
 * Projection engine: turns SeasonHistory into per-asset expected fantasy points
 * for the upcoming race, under five transparent presets, with session-aware
 * composition matched to the upcoming weekend's format.
 *
 * Pure: no I/O, no caching, no clock. The caller injects the history and the
 * upcoming weekend's shape.
 *
 * Key invariant (tested): for a normal (non-sprint) upcoming weekend,
 *   Σ perSession.expected === totalPoints === preset(elementwise quali+race)
 * Quali and race exist in the same set of races, so their preset weight
 * vectors are identical and the weighted mean is linear. Comparing against
 * whole-race points instead would be wrong: in sprint races those include the
 * sprint session.
 *
 * Equal PPM is per-race calibrated: k_class divides season points by season
 * price and by completed races, so its outputs sit on the same single-race
 * scale as the history presets. That matters because Equal PPM is also the
 * fallback mixed into history-preset results for no-history assets.
 */
import type {
  AssetProjection,
  ProjectionOptions,
  ProjectionResult,
  SessionExpectation,
  UpcomingWeekend,
} from "./types/projection"
import type { AssetHistory, SeasonHistory } from "@/lib/f1/types/history"
import type { PresetDefinition, PresetId } from "./types/presets"
import type { SessionLabelType } from "@/lib/f1/schemas"

import {
  EWMA_HALF_LIFE,
  FORM_WINDOW,
  HISTORY_PRESET_MIN_RACES,
  SPRINT_PRIOR_SHRINKAGE_K,
} from "@/lib/constants"

// ---------------------------------------------------------------------------
// Preset registry: labels and gating for the preset picker
// ---------------------------------------------------------------------------

export const PRESET_REGISTRY: readonly PresetDefinition[] = [
  {
    id: "weighted-recent",
    label: "Weighted recent",
    description: "Every race this season counts, but the latest ones count the most.",
    minRaces: HISTORY_PRESET_MIN_RACES,
    historyBased: true,
  },
  {
    id: "form-5",
    label: `Form (last ${FORM_WINDOW})`,
    description: `Only the last ${FORM_WINDOW} races count, all equally.`,
    minRaces: HISTORY_PRESET_MIN_RACES,
    historyBased: true,
  },
  {
    id: "season-average",
    label: "Season average",
    description: "Every race this season counts the same.",
    minRaces: HISTORY_PRESET_MIN_RACES,
    historyBased: true,
  },
  {
    id: "equal-ppm",
    label: "Equal PPM",
    description: "Points guessed from price alone, at the grid's average points per $1M.",
    minRaces: 0,
    historyBased: false,
  },
  {
    id: "custom-blend",
    label: "Custom blend",
    description: "You set the mix between Season average and Weighted recent.",
    minRaces: HISTORY_PRESET_MIN_RACES,
    historyBased: true,
  },
]

// ---------------------------------------------------------------------------
// Numeric primitives
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Exponentially weighted mean: the last element is the most recent (age 0),
 * w = 0.5^(age / halfLife), normalized over the present values only.
 * Exported for direct numeric testing.
 */
export function ewma(values: number[], halfLife: number): number {
  if (values.length === 0) return 0
  let num = 0
  let den = 0
  for (let i = 0; i < values.length; i++) {
    const age = values.length - 1 - i
    const w = 0.5 ** (age / halfLife)
    num += w * (values[i] ?? 0)
    den += w
  }
  return num / den
}

function formMean(values: number[], window: number): number {
  return mean(values.slice(-window))
}

type HistoryPresetId = "weighted-recent" | "form-5" | "season-average"

/** Apply a history preset's weighting to a chronological series. */
function applyPreset(preset: HistoryPresetId, series: number[]): number {
  switch (preset) {
    case "weighted-recent":
      return ewma(series, EWMA_HALF_LIFE)
    case "form-5":
      return formMean(series, FORM_WINDOW)
    case "season-average":
      return mean(series)
  }
}

// ---------------------------------------------------------------------------
// Series extraction (scored races only — pending excluded by construction)
// ---------------------------------------------------------------------------

/** Chronological per-race points for one session of one asset. */
function sessionSeries(history: AssetHistory, session: SessionLabelType): number[] {
  const series: number[] = []
  for (const race of history.perRace) {
    if (race.status !== "scored") continue
    for (const s of race.sessionPoints) {
      if (s.session === session && s.points !== null) {
        series.push(s.points)
        break
      }
    }
  }
  return series
}

// ---------------------------------------------------------------------------
// Equal PPM (per-race calibrated)
// ---------------------------------------------------------------------------

type ClassK = { driver: number; constructor: number }

/** Latest known price (the pending race row carries the current price). */
function currentPriceTenths(history: AssetHistory): number {
  return history.perRace[history.perRace.length - 1]?.priceTenths ?? 0
}

function computeClassK(season: SeasonHistory, completedRaces: number, notes: string[]): ClassK {
  // Cold start: no scored points anywhere — degenerate to a pure price
  // ranking (k = 1 point per tenth), labeled via the cold-start fallback.
  if (completedRaces === 0) return { driver: 1, constructor: 1 }

  const sums = {
    driver: { points: 0, priceTenths: 0 },
    constructor: { points: 0, priceTenths: 0 },
  }
  for (const history of Object.values(season.byPlayerId)) {
    sums[history.kind].points += history.cumulativePoints
    sums[history.kind].priceTenths += currentPriceTenths(history)
  }

  const k = (kind: AssetHistory["kind"]): number => {
    const { points, priceTenths } = sums[kind]
    if (points <= 0 || priceTenths <= 0) {
      notes.push(`equal-ppm: ${kind} class has non-positive points or price — k forced to 0`)
      return 0
    }
    // Per-race calibration: season points / season price / races → the
    // expected single-race scale (comparable with history presets).
    return points / priceTenths / completedRaces
  }

  return { driver: k("driver"), constructor: k("constructor") }
}

// ---------------------------------------------------------------------------
// Session composition
// ---------------------------------------------------------------------------

const NORMAL_SESSIONS: SessionLabelType[] = ["Qualifying", "Race"]
const SPRINT_SESSIONS: SessionLabelType[] = ["Sprint Qualifying", "Qualifying", "Race"]

/**
 * Grid-wide sprint/race points ratio over completed sprint races — the prior
 * scale for the sprint small-sample guard.
 */
function gridSprintRaceRatio(season: SeasonHistory): number {
  let sprint = 0
  let race = 0
  for (const history of Object.values(season.byPlayerId)) {
    for (const r of history.perRace) {
      if (r.status !== "scored") continue
      const sprintSession = r.sessionPoints.find((s) => s.session === "Sprint Qualifying")
      if (!sprintSession || sprintSession.points === null) continue
      sprint += sprintSession.points
      race += r.sessionPoints.find((s) => s.session === "Race")?.points ?? 0
    }
  }
  return race > 0 ? sprint / race : 1
}

function composeSessions(
  history: AssetHistory,
  upcoming: UpcomingWeekend,
  preset: HistoryPresetId | "custom-blend",
  blendWeight: number,
  gridRatio: number,
  completedSprints: number
): SessionExpectation[] {
  const sessions = upcoming.isSprint ? SPRINT_SESSIONS : NORMAL_SESSIONS

  const expectFor = (series: number[]): number =>
    preset === "custom-blend"
      ? blendWeight * applyPreset("weighted-recent", series) +
        (1 - blendWeight) * applyPreset("season-average", series)
      : applyPreset(preset, series)

  return sessions.map((session) => {
    const series = sessionSeries(history, session)
    const raw = expectFor(series)

    if (session !== "Sprint Qualifying") {
      return { session, expected: raw, basisRaces: series.length }
    }

    // Sprint small-sample guard: a season has only a handful of sprints, so
    // shrink the raw sprint mean toward the asset's race expectation scaled by
    // the grid-wide sprint/race ratio. The raw mean's weight grows as sprints
    // accumulate: α = completedSprints / (completedSprints + K).
    const raceSeries = sessionSeries(history, "Race")
    const raceExpectation = expectFor(raceSeries)
    const alpha = completedSprints / (completedSprints + SPRINT_PRIOR_SHRINKAGE_K)
    const expected = alpha * raw + (1 - alpha) * raceExpectation * gridRatio
    return { session, expected, basisRaces: series.length, priorBlended: true }
  })
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/**
 * Project every requested preset in one pass, computing the preset-independent
 * basis (completed races/sprints, class-K price coefficients, grid sprint ratio)
 * exactly once and sharing it across presets. The advisor RSC materializes all
 * four concrete presets per render, so this replaces four redundant full-grid
 * scans with one.
 */
export function projectAssetsMany<P extends PresetId>(
  season: SeasonHistory,
  upcoming: UpcomingWeekend,
  presets: readonly P[],
  options: { blendWeight?: number } = {}
): Record<P, ProjectionResult> {
  // --- Preset-independent basis (hoisted; shared by every preset) -----------
  const completedRaces = season.raceNumbers.filter((n) => n !== season.pendingRace).length
  let completedSprints = 0
  for (const n of season.raceNumbers) {
    if (n === season.pendingRace) continue
    const hasSprint = Object.values(season.byPlayerId).some((h) =>
      h.perRace.some(
        (r) => r.raceNumber === n && r.sessionPoints.some((s) => s.session === "Sprint Qualifying")
      )
    )
    if (hasSprint) completedSprints += 1
  }
  const basis = { completedRaces, completedSprints }
  const coldStart = completedRaces === 0
  const blendWeight = clamp01(options.blendWeight ?? 0.5)

  // computeClassK appends the same notes regardless of preset; collect once and
  // prepend the per-preset cold-start note (preserving the single-preset order).
  const classKNotes: string[] = []
  const classK = computeClassK(season, completedRaces, classKNotes)
  const gridRatio = upcoming.isSprint ? gridSprintRaceRatio(season) : 1

  const out = {} as Record<P, ProjectionResult>
  for (const requestedPreset of presets) {
    const notes: string[] = []
    const effectivePreset: PresetId = coldStart ? "equal-ppm" : requestedPreset
    if (coldStart && requestedPreset !== "equal-ppm") {
      notes.push(
        "no completed races yet — history presets unavailable, equal-ppm locked (price ranking)"
      )
    }
    notes.push(...classKNotes)

    const byPlayerId: Record<string, AssetProjection> = {}
    for (const history of Object.values(season.byPlayerId)) {
      const equalPpm = (fallback?: AssetProjection["fallback"]): AssetProjection => ({
        playerId: history.playerId,
        kind: history.kind,
        totalPoints: currentPriceTenths(history) * classK[history.kind],
        perSession: [],
        source: "equal-ppm",
        basis,
        ...(fallback ? { fallback } : {}),
      })

      if (coldStart) {
        byPlayerId[history.playerId] = equalPpm("equal-ppm-cold-start")
        continue
      }

      if (effectivePreset === "equal-ppm") {
        byPlayerId[history.playerId] = equalPpm()
        continue
      }

      // An asset with no scored race yet (e.g. a mid-season driver swap) has
      // nothing for a history preset to weight.
      if (!history.perRace.some((r) => r.status === "scored")) {
        byPlayerId[history.playerId] = equalPpm("equal-ppm-no-history")
        continue
      }

      const perSession = composeSessions(
        history,
        upcoming,
        effectivePreset,
        blendWeight,
        gridRatio,
        completedSprints
      )
      byPlayerId[history.playerId] = {
        playerId: history.playerId,
        kind: history.kind,
        totalPoints: perSession.reduce((sum, s) => sum + s.expected, 0),
        perSession,
        source: effectivePreset,
        basis,
      }
    }

    out[requestedPreset] = {
      byPlayerId,
      requestedPreset,
      effectivePreset,
      basis,
      coldStart,
      notes,
    }
  }

  return out
}

/** Single-preset projection — a thin delegate over projectAssetsMany. */
export function projectAssets(
  season: SeasonHistory,
  upcoming: UpcomingWeekend,
  options: ProjectionOptions
): ProjectionResult {
  return projectAssetsMany(season, upcoming, [options.preset], {
    blendWeight: options.blendWeight,
  })[options.preset]
}
