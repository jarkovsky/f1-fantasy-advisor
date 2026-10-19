/**
 * Projection preset identities. PRESET_IDS is the single source of truth: the
 * PresetId union is derived from it, which is why this types file holds a
 * value. Labels and gating (PRESET_REGISTRY) and the engine live in ../engine.ts.
 */

export const PRESET_IDS = [
  "weighted-recent",
  "form-5",
  "season-average",
  "equal-ppm",
  "custom-blend",
] as const

export type PresetId = (typeof PRESET_IDS)[number]

/** Presets the server materializes; `custom-blend` is client-derived. */
export type ConcretePresetId = Exclude<PresetId, "custom-blend">

export type PresetDefinition = {
  id: PresetId
  label: string
  /** One plain-language sentence for the picker (docs/projection-models.md has the long form). */
  description: string
  /** History presets need ≥N completed races; equal-ppm works from race 1. */
  minRaces: number
  /** True for presets computed from per-race history (greyed at cold start). */
  historyBased: boolean
}
