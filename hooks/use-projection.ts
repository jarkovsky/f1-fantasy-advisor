"use client"

import type { ConcretePresetId, PresetId } from "@/lib/projections/types/presets"
import type { ProjectionResult } from "@/lib/projections/types/projection"

import { useDeferredValue, useMemo } from "react"

import { resolveClientProjection } from "@/lib/advisor/projection-resolve"

/**
 * Resolve the active projection for the current preset + blend, plus a flat
 * totals map. Memoized: the custom-blend path builds a fresh byPlayerId map each
 * call, so without this memo `totals` — and the optimizer effect keyed on it —
 * would re-materialize on every incidental re-render (the 30s clock tick, store
 * mutations), re-running the full ~1.45M-combination search.
 */
export function useProjection(
  byPreset: Record<ConcretePresetId, ProjectionResult>,
  preset: PresetId,
  blendWeight: number
): { projection: ProjectionResult; totals: Record<string, number> } {
  const deferredBlend = useDeferredValue(blendWeight)
  const projection = useMemo(
    () => resolveClientProjection(byPreset, preset, deferredBlend),
    [byPreset, preset, deferredBlend]
  )
  const totals = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const [id, p] of Object.entries(projection.byPlayerId)) {
      out[id] = p.totalPoints
    }
    return out
  }, [projection])

  return { projection, totals }
}
