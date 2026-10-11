import type { ProjectionResult, UpcomingWeekend } from "@/lib/projections/types/projection"
import type { ConcretePresetId } from "@/lib/projections/types/presets"

import { describe, expect, it } from "vitest"

import race6 from "@/lib/f1/__fixtures__/drivers.race6.json"
import { projectAssets } from "@/lib/projections/engine"
import { parseDriversFeed } from "@/lib/f1/schemas"
import { assembleHistory } from "@/lib/f1/history"

import { fixtureHistory } from "@/test/fixtures"

import { resolveClientProjection } from "./projection-resolve"

// The concrete presets the server materializes (custom-blend is client-derived).
const CONCRETE: ConcretePresetId[] = ["weighted-recent", "form-5", "season-average", "equal-ppm"]

/** Build the byPreset record exactly as the server does: projectAssets ×4. */
function buildByPreset(
  history: Parameters<typeof projectAssets>[0],
  weekend: UpcomingWeekend
): Record<ConcretePresetId, ProjectionResult> {
  const out = {} as Record<ConcretePresetId, ProjectionResult>
  for (const preset of CONCRETE) {
    out[preset] = projectAssets(history, weekend, { preset })
  }
  return out
}

describe("resolveClientProjection — custom-blend wire format", () => {
  const history = fixtureHistory(6)

  for (const isSprint of [false, true]) {
    const weekend: UpcomingWeekend = { isSprint }

    describe(isSprint ? "sprint weekend" : "normal weekend", () => {
      const byPreset = buildByPreset(history, weekend)

      for (const w of [0, 0.25, 0.5, 0.9, 1]) {
        it(`w=${w} matches projectAssets(custom-blend)`, () => {
          const resolved = resolveClientProjection(byPreset, "custom-blend", w)
          const expected = projectAssets(history, weekend, {
            preset: "custom-blend",
            blendWeight: w,
          })

          const ids = Object.keys(expected.byPlayerId)
          expect(ids.length).toBeGreaterThan(0)

          for (const id of ids) {
            const got = resolved.byPlayerId[id]
            const exp = expected.byPlayerId[id]
            expect(got).toBeDefined()
            expect(exp).toBeDefined()
            if (!got || !exp) continue

            expect(got.totalPoints).toBeCloseTo(exp.totalPoints, 10)
            expect(got.perSession.length).toBe(exp.perSession.length)
            for (let i = 0; i < exp.perSession.length; i++) {
              const gs = got.perSession[i]
              const es = exp.perSession[i]
              expect(gs?.session).toBe(es?.session)
              expect(gs?.expected).toBeCloseTo(es?.expected ?? NaN, 10)
            }
          }

          expect(resolved.requestedPreset).toBe("custom-blend")
          expect(resolved.effectivePreset).toBe("custom-blend")
          expect(resolved.coldStart).toBe(false)
        })
      }
    })
  }

  it("returns the concrete preset object by identity", () => {
    const byPreset = buildByPreset(history, { isSprint: false })
    for (const preset of CONCRETE) {
      expect(resolveClientProjection(byPreset, preset)).toBe(byPreset[preset])
    }
  })

  it("cold start → returns the equal-ppm result object", () => {
    const res = parseDriversFeed(race6)
    if (!res.ok) throw new Error(res.summary.join("; "))
    // Race 6 alone is entirely pending → coldStart.
    const pendingOnly = assembleHistory([{ raceNumber: 6, assets: res.data }])
    const byPreset = buildByPreset(pendingOnly, { isSprint: false })
    expect(byPreset["season-average"].coldStart).toBe(true)
    expect(resolveClientProjection(byPreset, "custom-blend", 0.5)).toBe(byPreset["equal-ppm"])
  })

  it("clamps blendWeight to [0, 1]", () => {
    const byPreset = buildByPreset(history, { isSprint: false })
    const atZero = resolveClientProjection(byPreset, "custom-blend", 0)
    const belowZero = resolveClientProjection(byPreset, "custom-blend", -1)
    const atOne = resolveClientProjection(byPreset, "custom-blend", 1)
    const aboveOne = resolveClientProjection(byPreset, "custom-blend", 2)

    for (const id of Object.keys(atZero.byPlayerId)) {
      expect(belowZero.byPlayerId[id]?.totalPoints).toBeCloseTo(
        atZero.byPlayerId[id]?.totalPoints ?? NaN,
        10
      )
      expect(aboveOne.byPlayerId[id]?.totalPoints).toBeCloseTo(
        atOne.byPlayerId[id]?.totalPoints ?? NaN,
        10
      )
    }
  })
})
