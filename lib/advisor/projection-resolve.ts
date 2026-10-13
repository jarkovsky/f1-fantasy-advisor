/**
 * Client-side preset resolver.
 *
 * The server never serializes SeasonHistory; it ships every concrete preset
 * pre-computed (see AdvisorServerProps.projectionsByPreset). The "custom-blend"
 * preset is derived here, in the browser, by linear interpolation between
 * "season-average" (w=0) and "weighted-recent" (w=1). This is exact, not an
 * approximation: the projection engine's blend is itself linear in the two
 * endpoints, so a per-field lerp reproduces projectAssets(..., {preset:
 * "custom-blend", blendWeight}) to floating-point precision. That equivalence
 * is pinned by projection-resolve.test.ts.
 *
 * Pure (no I/O, no clock) and cheap enough to run on every advisor render.
 */
import type {
  AssetProjection,
  ProjectionResult,
  SessionExpectation,
} from "@/lib/projections/types/projection"
import type { ConcretePresetId, PresetId } from "@/lib/projections/types/presets"

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/**
 * Lerp one asset's projection between the season-average (A) and
 * weighted-recent (B) endpoints. Sessions zip by index: by construction both
 * endpoints were projected for the same upcoming weekend on the same history,
 * so their session lists are identical in length and label (asserted below).
 * basisRaces is preset-independent (it counts scored sessions), so it is
 * copied; priorBlended carries through identically.
 */
function lerpAsset(a: AssetProjection, b: AssetProjection, w: number): AssetProjection {
  // Per-asset fallback: when the B-side asset fell back to equal-ppm (no
  // history / mid-season swap), both endpoints hold the identical equal-ppm
  // value (the engine forces equal-ppm for that asset under every history
  // preset), so the lerp is the identity — copy B, source and fallback included.
  if (b.fallback) return { ...b }

  if (a.perSession.length !== b.perSession.length) {
    throw new Error(
      `projection-resolve: session count mismatch for ${b.playerId} (` +
        `${a.perSession.length} vs ${b.perSession.length})`
    )
  }

  const perSession: SessionExpectation[] = b.perSession.map((bs, i) => {
    const as = a.perSession[i]
    if (!as || as.session !== bs.session) {
      throw new Error(`projection-resolve: session label mismatch for ${b.playerId} at ${i}`)
    }
    return {
      session: bs.session,
      expected: (1 - w) * as.expected + w * bs.expected,
      basisRaces: bs.basisRaces,
      ...(bs.priorBlended !== undefined ? { priorBlended: bs.priorBlended } : {}),
    }
  })

  return {
    playerId: b.playerId,
    kind: b.kind,
    totalPoints: (1 - w) * a.totalPoints + w * b.totalPoints,
    perSession,
    source: "custom-blend",
    basis: b.basis,
  }
}

/**
 * Resolve the effective ProjectionResult for the chosen preset.
 *
 * - Concrete preset → the server's pre-computed result, returned as-is (same
 *   reference, so memoized consumers can compare with ===).
 * - "custom-blend" → at cold start the engine forces equal-ppm, so we return
 *   the equal-ppm result object directly; otherwise lerp season-average ↔
 *   weighted-recent at w = clamp(blendWeight ?? 0.5).
 */
export function resolveClientProjection(
  byPreset: Record<ConcretePresetId, ProjectionResult>,
  preset: PresetId,
  blendWeight?: number
): ProjectionResult {
  if (preset !== "custom-blend") {
    return byPreset[preset]
  }

  const seasonAverage = byPreset["season-average"]
  // Cold start: history presets unavailable — the engine forces equal-ppm.
  if (seasonAverage.coldStart) {
    return byPreset["equal-ppm"]
  }

  const w = clamp01(blendWeight ?? 0.5)
  const a = seasonAverage // w = 0 endpoint
  const b = byPreset["weighted-recent"] // w = 1 endpoint

  const byPlayerId: Record<string, AssetProjection> = {}
  for (const id of Object.keys(b.byPlayerId)) {
    const bp = b.byPlayerId[id]
    const ap = a.byPlayerId[id]
    if (!bp || !ap) {
      throw new Error(`projection-resolve: asset ${id} missing from an endpoint`)
    }
    byPlayerId[id] = lerpAsset(ap, bp, w)
  }

  return {
    byPlayerId,
    requestedPreset: "custom-blend",
    effectivePreset: "custom-blend",
    basis: b.basis,
    coldStart: false,
    notes: [...new Set([...a.notes, ...b.notes])], // order-preserving union
  }
}
