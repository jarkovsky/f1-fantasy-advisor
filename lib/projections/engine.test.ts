import type { RacePayload, SeasonHistory } from "@/lib/f1/types/history"
import type { SessionPoints } from "@/lib/f1/schemas"

import { describe, expect, it } from "vitest"

import race1 from "@/lib/f1/__fixtures__/drivers.race1.json"
import race2 from "@/lib/f1/__fixtures__/drivers.race2.json"
import race3 from "@/lib/f1/__fixtures__/drivers.race3.json"
import race4 from "@/lib/f1/__fixtures__/drivers.race4.json"
import race5 from "@/lib/f1/__fixtures__/drivers.race5.json"
import race6 from "@/lib/f1/__fixtures__/drivers.race6.json"
import { parseDriversFeed } from "@/lib/f1/schemas"
import { assembleHistory } from "@/lib/f1/history"
import { EWMA_HALF_LIFE } from "@/lib/constants"

import { PRESET_REGISTRY, ewma, projectAssets, projectAssetsMany } from "./engine"
import { PRESET_IDS, type PresetId } from "./types/presets"

// Real fixtures (captured 2026-06-05): Gasly 18, Verstappen 131, Mercedes 28,
// Red Bull 29 across races 1..6 (race 6 = Monaco, pending). Sprints: 2, 4, 5.
// Per-race totals — Gasly: 11, 20, 14, -8, 16; Verstappen: 50, 14, 13, 52, 26.

function payload(raceNumber: number, fixture: unknown): RacePayload {
  const res = parseDriversFeed(fixture)
  if (!res.ok) throw new Error(res.summary.join("; "))
  return { raceNumber, assets: res.data }
}

const ALL = [
  payload(1, race1),
  payload(2, race2),
  payload(3, race3),
  payload(4, race4),
  payload(5, race5),
  payload(6, race6),
]

const SEASON = assembleHistory(ALL)
const HISTORY_PRESETS = ["weighted-recent", "form-5", "season-average"] as const

function projection(
  season: SeasonHistory,
  preset: PresetId,
  isSprint = false,
  blendWeight?: number
) {
  return projectAssets(
    season,
    { isSprint },
    blendWeight === undefined ? { preset } : { preset, blendWeight }
  )
}

/** Elementwise quali+race series for the session-sum invariant reference. */
function qualiPlusRaceSeries(playerId: string): number[] {
  const history = SEASON.byPlayerId[playerId]
  if (!history) throw new Error(`no asset ${playerId}`)
  const series: number[] = []
  for (const race of history.perRace) {
    if (race.status !== "scored") continue
    const pts = (label: SessionPoints["session"]) =>
      race.sessionPoints.find((s) => s.session === label)?.points ?? 0
    series.push(pts("Qualifying") + pts("Race"))
  }
  return series
}

function presetReference(preset: (typeof HISTORY_PRESETS)[number], series: number[]) {
  if (preset === "weighted-recent") return ewma(series, EWMA_HALF_LIFE)
  const window = preset === "form-5" ? series.slice(-5) : series
  return window.reduce((a, b) => a + b, 0) / window.length
}

describe("PRESET_REGISTRY", () => {
  it("exposes all five presets with stable ids", () => {
    expect(PRESET_REGISTRY.map((p) => p.id)).toEqual([...PRESET_IDS])
  })

  it("history presets gate on minRaces; equal-ppm works from race 1", () => {
    for (const p of PRESET_REGISTRY) {
      expect(p.minRaces).toBe(p.historyBased ? 1 : 0)
    }
  })

  it("rejects an unknown preset id at the type level", () => {
    // @ts-expect-error — "nope" is not a PresetId
    projectAssets(SEASON, { isSprint: false }, { preset: "nope" })
  })
})

describe("EWMA exactness", () => {
  it("weights halve every 3 races, normalized over present races", () => {
    // Gasly whole-race series: [11, 20, 14, -8, 16]
    expect(ewma([11, 20, 14, -8, 16], 3)).toBeCloseTo(9.8885963, 6)
  })

  it("single-value series: EWMA equals the value", () => {
    expect(ewma([11], 3)).toBe(11)
  })

  it("empty series: 0", () => {
    expect(ewma([], 3)).toBe(0)
  })
})

describe("history presets — normal-weekend totals (E[quali] + E[race])", () => {
  const expected: Record<string, Record<string, number>> = {
    "weighted-recent": {
      "18": 7.789973,
      "131": 26.514659,
      "28": 81.574227,
      "29": 34.747099,
    },
    // Form-5 == Season-average at exactly n=5 completed races (window = all);
    // the windowing distinction is covered by the synthetic 6-race test below.
    "form-5": { "18": 9.0, "131": 26.4, "28": 85.6, "29": 33.6 },
    "season-average": { "18": 9.0, "131": 26.4, "28": 85.6, "29": 33.6 },
  }

  for (const preset of HISTORY_PRESETS) {
    it(preset, () => {
      const result = projection(SEASON, preset)
      for (const [playerId, total] of Object.entries(expected[preset] ?? {})) {
        expect(result.byPlayerId[playerId]?.totalPoints).toBeCloseTo(total, 5)
      }
    })
  }
})

describe("session-sum invariant (normal weekend)", () => {
  it("Σ perSession.expected === totalPoints for every asset × preset", () => {
    for (const preset of HISTORY_PRESETS) {
      const result = projection(SEASON, preset)
      for (const p of Object.values(result.byPlayerId)) {
        const sum = p.perSession.reduce((acc, s) => acc + s.expected, 0)
        expect(sum).toBeCloseTo(p.totalPoints, 9)
      }
    }
  })

  it("totalPoints === preset(elementwise quali+race sums)", () => {
    for (const preset of HISTORY_PRESETS) {
      const result = projection(SEASON, preset)
      for (const playerId of ["18", "131", "28", "29"]) {
        const reference = presetReference(preset, qualiPlusRaceSeries(playerId))
        expect(result.byPlayerId[playerId]?.totalPoints).toBeCloseTo(reference, 9)
      }
    }
  })
})

describe("equal-ppm (per-race calibrated)", () => {
  const result = projection(SEASON, "equal-ppm")

  it("projects on the single-race scale (k per class / completed races)", () => {
    // k_driver = (53+155)/(122+284)/5; k_con = (483+187)/(308+293)/5
    expect(result.byPlayerId["18"]?.totalPoints).toBeCloseTo(122 * (208 / 406 / 5), 6)
    expect(result.byPlayerId["131"]?.totalPoints).toBeCloseTo(284 * (208 / 406 / 5), 6)
    expect(result.byPlayerId["28"]?.totalPoints).toBeCloseTo(308 * (670 / 601 / 5), 6)
    expect(result.byPlayerId["29"]?.totalPoints).toBeCloseTo(293 * (670 / 601 / 5), 6)
  })

  it("constructors score ~2× drivers per price (class-separated k)", () => {
    const kDriver = 208 / 406 / 5
    const kCon = 670 / 601 / 5
    expect(kCon / kDriver).toBeGreaterThan(2)
    expect(kCon / kDriver).toBeLessThan(2.4)
  })

  it("is a direct total: perSession is empty", () => {
    for (const p of Object.values(result.byPlayerId)) {
      expect(p.perSession).toEqual([])
      expect(p.source).toBe("equal-ppm")
    }
  })

  it("a class with non-positive cumulative points → k = 0 + note", () => {
    const tampered = structuredClone(SEASON)
    for (const h of Object.values(tampered.byPlayerId)) {
      if (h.kind === "constructor") h.cumulativePoints = -5
    }
    const r = projection(tampered, "equal-ppm")
    expect(r.byPlayerId["28"]?.totalPoints).toBe(0)
    expect(r.notes.some((n) => n.includes("constructor"))).toBe(true)
    // drivers unaffected
    expect(r.byPlayerId["18"]?.totalPoints).toBeGreaterThan(0)
  })
})

describe("sprint-weekend composition (isSprint: true)", () => {
  it("Verstappen E[sprint] under season-average == 8.136842 (α=0.6, R=105/285)", () => {
    const result = projection(SEASON, "season-average", true)
    const sprint = result.byPlayerId["131"]?.perSession.find(
      (s) => s.session === "Sprint Qualifying"
    )
    expect(sprint?.expected).toBeCloseTo(8.136842, 5)
    expect(sprint?.priorBlended).toBe(true)
    expect(sprint?.basisRaces).toBe(3)
  })

  it("Verstappen E[sprint] under weighted-recent == 7.403316", () => {
    const result = projection(SEASON, "weighted-recent", true)
    const sprint = result.byPlayerId["131"]?.perSession.find(
      (s) => s.session === "Sprint Qualifying"
    )
    expect(sprint?.expected).toBeCloseTo(7.403316, 5)
  })

  it("sprint weekends compose three sessions; totals include the sprint", () => {
    const result = projection(SEASON, "season-average", true)
    const ver = result.byPlayerId["131"]
    expect(ver?.perSession).toHaveLength(3)
    expect(ver?.totalPoints).toBeCloseTo(2.4 + 24.0 + 8.136842, 5)
  })

  it("normal weekends never run the sprint branch (no priorBlended)", () => {
    const result = projection(SEASON, "weighted-recent", false)
    for (const p of Object.values(result.byPlayerId)) {
      expect(p.perSession).toHaveLength(2)
      expect(p.perSession.every((s) => s.priorBlended === undefined)).toBe(true)
    }
  })
})

describe("custom-blend", () => {
  it("blendWeight 1 == weighted-recent, 0 == season-average", () => {
    const w = projection(SEASON, "custom-blend", false, 1)
    const s = projection(SEASON, "custom-blend", false, 0)
    expect(w.byPlayerId["18"]?.totalPoints).toBeCloseTo(7.789973, 5)
    expect(s.byPlayerId["18"]?.totalPoints).toBeCloseTo(9.0, 9)
  })

  it("blendWeight 0.5 is the per-session midpoint, summed", () => {
    const half = projection(SEASON, "custom-blend", false, 0.5)
    expect(half.byPlayerId["18"]?.totalPoints).toBeCloseTo((7.789973 + 9) / 2, 5)
  })

  it("clamps out-of-range blendWeight", () => {
    const over = projection(SEASON, "custom-blend", false, 7)
    expect(over.byPlayerId["18"]?.totalPoints).toBeCloseTo(7.789973, 5)
    const under = projection(SEASON, "custom-blend", false, -3)
    expect(under.byPlayerId["18"]?.totalPoints).toBeCloseTo(9.0, 9)
  })
})

describe("custom blend linearity", () => {
  // Pins custom-blend == the exact per-session lerp of its two endpoint
  // presets: E_custom(w) = (1−w)·E_season-average + w·E_weighted-recent, for
  // both totals and every perSession entry, on normal and sprint weekends.
  //
  // Why exact, and why it matters: α (sprint shrinkage) and the grid ratio R
  // are preset-independent scalars, so the sprint guard
  //   E = α·raw + (1−α)·E_race·R
  // stays affine in the underlying preset means — blending two presets and
  // blending the resulting expectations are the same operation. That exactness
  // is what lets the client derive custom-blend by lerping the two endpoint
  // preset projections in the browser, instead of shipping the full
  // SeasonHistory across the RSC boundary to recompute it.
  for (const isSprint of [false, true]) {
    const label = isSprint ? "sprint weekend" : "normal weekend"
    const seasonAvg = projection(SEASON, "season-average", isSprint)
    const weightedRecent = projection(SEASON, "weighted-recent", isSprint)

    for (const w of [0.25, 0.5, 0.9]) {
      it(`w=${w} (${label}): total + per-session == lerp of endpoints`, () => {
        const blended = projection(SEASON, "custom-blend", isSprint, w)
        for (const [playerId, p] of Object.entries(blended.byPlayerId)) {
          const lo = seasonAvg.byPlayerId[playerId]
          const hi = weightedRecent.byPlayerId[playerId]
          expect(lo).toBeDefined()
          expect(hi).toBeDefined()
          if (!lo || !hi) continue

          const lerp = (a: number, b: number) => (1 - w) * a + w * b

          expect(p.totalPoints).toBeCloseTo(lerp(lo.totalPoints, hi.totalPoints), 10)

          for (const session of p.perSession) {
            const loS = lo.perSession.find((s) => s.session === session.session)
            const hiS = hi.perSession.find((s) => s.session === session.session)
            expect(loS).toBeDefined()
            expect(hiS).toBeDefined()
            if (!loS || !hiS) continue
            expect(session.expected).toBeCloseTo(lerp(loS.expected, hiS.expected), 10)
          }
        }
      })
    }
  }
})

describe("cold start & fallbacks", () => {
  it("no completed races → coldStart, equal-ppm locked, price ranking", () => {
    // Race 6 alone is entirely pending.
    const pendingOnly = assembleHistory([payload(6, race6)])
    const result = projection(pendingOnly, "weighted-recent")
    expect(result.coldStart).toBe(true)
    expect(result.effectivePreset).toBe("equal-ppm")
    expect(result.requestedPreset).toBe("weighted-recent")
    // degenerate k = 1 point per tenth → pure price ranking
    expect(result.byPlayerId["18"]?.totalPoints).toBe(122)
    expect(result.byPlayerId["18"]?.fallback).toBe("equal-ppm-cold-start")
    expect(result.notes.length).toBeGreaterThan(0)
  })

  it("mid-season swap: only the no-history asset falls back", () => {
    const race1WithoutGasly = {
      raceNumber: 1,
      assets: payload(1, race1).assets.filter((a) => a.playerId !== "18"),
    }
    const season = assembleHistory([race1WithoutGasly, payload(6, race6)])
    const result = projection(season, "season-average")
    expect(result.byPlayerId["18"]?.fallback).toBe("equal-ppm-no-history")
    expect(result.byPlayerId["18"]?.source).toBe("equal-ppm")
    expect(result.byPlayerId["131"]?.fallback).toBeUndefined()
    expect(result.byPlayerId["131"]?.source).toBe("season-average")
  })

  it("basis counts: 5 completed races, 3 sprints; pending race excluded", () => {
    const result = projection(SEASON, "season-average")
    expect(result.basis).toEqual({ completedRaces: 5, completedSprints: 3 })
    // Gasly's season average is over 5 scored races, not 6
    expect(result.byPlayerId["18"]?.perSession[0]?.basisRaces).toBe(5)
  })

  it("asset present in one race only → preset equals that race's values", () => {
    const single = assembleHistory([payload(1, race1)])
    const result = projection(single, "weighted-recent")
    // Gasly race 1: quali 0 + race 11
    expect(result.byPlayerId["18"]?.totalPoints).toBeCloseTo(11, 9)
  })
})

describe("form-5 windowing (synthetic 6-race history)", () => {
  it("form uses the last 5 races, season average uses all", () => {
    const sessionPoints = (points: number): SessionPoints[] => [
      {
        session: "Qualifying",
        sessionNumber: 1,
        points: 0,
        noNegativePoints: 0,
      },
      { session: "Race", sessionNumber: 2, points, noNegativePoints: points },
    ]
    const points = [60, 0, 0, 0, 0, 0] // race 1 monster score, then nothing
    const season: SeasonHistory = {
      byPlayerId: {
        x: {
          playerId: "x",
          kind: "driver",
          displayName: "X",
          teamName: null,
          perRace: points.map((p, i) => ({
            raceNumber: i + 1,
            priceTenths: 100,
            prevPriceTenths: 100,
            points: p,
            sessionPoints: sessionPoints(p),
            selectedPercent: 1,
            status: "scored" as const,
          })),
          cumulativePoints: 60,
          cumulativeByRace: [],
          priceDeltaTenths: 0,
          latestAdditionalStats: null,
        },
      },
      raceNumbers: [1, 2, 3, 4, 5, 6],
      pendingRace: null,
      warnings: [],
    }
    const form = projection(season, "form-5")
    const avg = projection(season, "season-average")
    expect(form.byPlayerId.x?.totalPoints).toBeCloseTo(0, 9) // race 1 dropped
    expect(avg.byPlayerId.x?.totalPoints).toBeCloseTo(10, 9) // 60/6
  })
})

// ---------------------------------------------------------------------------
// projectAssetsMany shares the preset-independent basis (completed races/sprints,
// class-K, grid ratio) across presets. This pins that batching produces the
// byte-identical result of calling projectAssets once per preset — i.e. the
// hoisting leaks no state (notes aliasing, mutation) between presets.
// ---------------------------------------------------------------------------
describe("projectAssetsMany — equivalence with per-preset projectAssets", () => {
  const COLD = assembleHistory([payload(6, race6)]) // race 6 pending → 0 completed
  const cases: [string, SeasonHistory, boolean][] = [
    ["warm, non-sprint", SEASON, false],
    ["warm, sprint", SEASON, true],
    ["cold start, non-sprint", COLD, false],
    ["cold start, sprint", COLD, true],
  ]

  for (const [label, season, isSprint] of cases) {
    it(`matches projectAssets for every preset — ${label}`, () => {
      const many = projectAssetsMany(season, { isSprint }, PRESET_IDS)
      for (const preset of PRESET_IDS) {
        expect(many[preset]).toEqual(projectAssets(season, { isSprint }, { preset }))
      }
    })
  }
})
