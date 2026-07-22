import { describe, expect, it } from "vitest"

import constraintsFixture from "./__fixtures__/constraints.json"
import race1 from "./__fixtures__/drivers.race1.json"
import race4 from "./__fixtures__/drivers.race4.json"
import race6 from "./__fixtures__/drivers.race6.json"
import mixapiFixture from "./__fixtures__/mixapi.json"
import racedayFixture from "./__fixtures__/raceday.excerpt.json"
import {
  AssetSchema,
  parseConstraints,
  parseDriversFeed,
  parseMixapi,
  parseRaceday,
} from "./schemas"
import { INITIAL_BUDGET_TENTHS } from "@/lib/constants"

// Fixtures are slimmed REAL payloads captured 2026-06-05 (race 6 = Monaco,
// pre-race). Each drivers fixture keeps the same 4 assets: Gasly (18),
// Verstappen (131), Mercedes (28), Red Bull (29).

function asset(feed: unknown, playerId: string) {
  const res = parseDriversFeed(feed)
  if (!res.ok) throw new Error(res.summary.join("; "))
  const found = res.data.find((a) => a.playerId === playerId)
  if (!found) throw new Error(`asset ${playerId} not in fixture`)
  return found
}

describe("parseDriversFeed — real fixture acceptance", () => {
  it("parses a completed normal weekend (race 1)", () => {
    const res = parseDriversFeed(race1)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toHaveLength(4)
    expect(res.dropped).toBe(0)
  })

  it("maps a driver: typo'd names normalized, money in integer tenths", () => {
    const gasly = asset(race1, "18")
    expect(gasly.kind).toBe("driver")
    expect(gasly.fullName).toBe("Pierre Gasly") // from FUllName
    expect(gasly.priceTenths).toBe(120) // 12.0 → 120, exact
    expect(gasly.racePoints).toBe(11) // '11.00'
    expect(gasly.sessionPoints).toHaveLength(2)
    if (gasly.kind === "driver") {
      expect(gasly.constructorId).toBe("23") // Alpine's PlayerId
      expect(gasly.teamName).toBe("Alpine")
    }
  })

  it("maps a constructor: teamName from FUllName, empty fields → null", () => {
    const mercedes = asset(race1, "28")
    expect(mercedes.kind).toBe("constructor")
    expect(mercedes.teamName).toBe("Mercedes")
    expect(mercedes.priceTenths).toBe(293) // 29.3
    if (mercedes.kind === "constructor") {
      // raw TeamName/CountryName are '' for constructors
      expect("countryName" in mercedes).toBe(false)
    }
  })

  it("parses a sprint weekend (race 4): 3 sessions incl. 'Sprint Qualifying'", () => {
    const ver = asset(race4, "131")
    expect(ver.sessionPoints).toHaveLength(3)
    expect(ver.sessionPoints.map((s) => s.session)).toContain(
      "Sprint Qualifying"
    )
    // race-weekend total equals the session sum (6 + 9 + 37 = 52)
    const sum = ver.sessionPoints.reduce((acc, s) => acc + (s.points ?? 0), 0)
    expect(sum).toBe(52)
    expect(ver.racePoints).toBe(52)
  })

  it("detects the pre-race pending state (race 6): points null, not 0", () => {
    const gasly = asset(race6, "18")
    expect(gasly.racePoints).toBeNull() // raw was '0' + null sessions
    expect(gasly.noNegativePoints).toBeNull()
    expect(gasly.sessionPoints.every((s) => s.points === null)).toBe(true)
  })

  it("rejects the envelope when Meta indicates failure", () => {
    const bad = structuredClone(race1) as unknown as {
      Meta: { Success: boolean }
    }
    bad.Meta.Success = false
    const res = parseDriversFeed(bad)
    expect(res.ok).toBe(false)
  })

  it("drops a corrupt asset without failing the rest", () => {
    const tampered = structuredClone(race1) as typeof race1
    ;(tampered.Data.Value as unknown[]).push({ garbage: true })
    const res = parseDriversFeed(tampered)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toHaveLength(4)
    expect(res.dropped).toBe(1)
  })

  it("fails when every asset row is corrupt", () => {
    const res = parseDriversFeed({
      Data: { Value: [{ nope: 1 }] },
      Meta: { Success: true, StatusCode: 200 },
    })
    expect(res.ok).toBe(false)
  })
})

describe("AssetSchema edge cases", () => {
  it("rejects a Skill/PositionName contradiction", () => {
    const raw = structuredClone(
      (race1.Data.Value as { Skill: number }[])[0]
    ) as { Skill: number }
    raw.Skill = 2 // driver row claiming to be a constructor
    expect(AssetSchema.safeParse(raw).success).toBe(false)
  })

  it("money conversion is exact at awkward floats", () => {
    const raw = structuredClone(race1.Data.Value[0]) as { Value: number }
    raw.Value = 29.9 // 29.9 * 10 = 298.99999… without rounding
    const res = AssetSchema.safeParse(raw)
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.priceTenths).toBe(299)
  })

  it("an unknown session label degrades to 'Race' instead of rejecting", () => {
    const raw = structuredClone(race1.Data.Value[0]) as {
      SessionWisePoints: { sessiontype: string }[]
    }
    const session = raw.SessionWisePoints[0]
    if (!session) throw new Error("fixture has no sessions")
    session.sessiontype = "Warmup"
    const res = AssetSchema.safeParse(raw)
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.sessionPoints[0]?.session).toBe("Race")
  })
})

describe("parseConstraints", () => {
  it("maps the real fixture", () => {
    const res = parseConstraints(constraintsFixture)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.raceNumber).toBe(6)
    expect(res.data.lastCompletedRace).toBe(5)
    expect(res.data.seasonEndRace).toBe(22)
    // cross-check the rulebook constant against the live feed
    expect(res.data.budgetCapTenths).toBe(INITIAL_BUDGET_TENTHS)
  })

  it("carries DeadlineDate as advisory only", () => {
    const res = parseConstraints(constraintsFixture)
    if (!res.ok) throw new Error("parse failed")
    // the verified-stale value — kept for debugging, never used as the lock
    expect(res.data.advisoryDeadlineRaw).toBe("06/05/2026 00:00:00")
  })

  it("rejects a malformed payload", () => {
    expect(parseConstraints({ Data: { Value: {} } }).ok).toBe(false)
  })
})

describe("parseRaceday — session rows → RaceWeekend[]", () => {
  function weekends() {
    const res = parseRaceday(racedayFixture)
    if (!res.ok) throw new Error(res.summary.join("; "))
    return res.data
  }

  it("groups the flat session rows by race", () => {
    const w = weekends()
    expect(w.map((x) => x.raceNumber)).toEqual([5, 6, 7])
  })

  it("derives the REAL lock from the first session's ISO8601 start", () => {
    const monaco = weekends().find((w) => w.raceNumber === 6)
    if (!monaco) throw new Error("no race 6")
    // Monaco quali 2026-06-06 16:00 +02:00 — NOT constraints.DeadlineDate
    expect(monaco.lockAtMs).toBe(Date.parse("2026-06-06T16:00:00+02:00"))
    expect(monaco.raceEndsApproxMs).toBe(
      Date.parse("2026-06-07T17:00:00+02:00")
    )
    expect(monaco.gpName).toBe("Monaco Grand Prix")
  })

  it("detects sprint weekends by session label, not a hardcoded list", () => {
    const w = weekends()
    expect(w.find((x) => x.raceNumber === 5)?.isSprint).toBe(true) // Canada
    expect(w.find((x) => x.raceNumber === 6)?.isSprint).toBe(false) // Monaco
  })

  it("maps race status per weekend (4 completed / 1 current / 0 upcoming)", () => {
    const w = weekends()
    expect(w.find((x) => x.raceNumber === 5)?.status).toBe(4)
    expect(w.find((x) => x.raceNumber === 6)?.status).toBe(1)
    expect(w.find((x) => x.raceNumber === 7)?.status).toBe(0)
  })

  it("sorts sessions chronologically (sprint quali first on sprint weekends)", () => {
    const canada = weekends().find((w) => w.raceNumber === 5)
    if (!canada) throw new Error("no race 5")
    expect(canada.sessions.map((s) => s.session)).toEqual([
      "Sprint Qualifying",
      "Qualifying",
      "Race",
    ])
  })
})

describe("parseMixapi", () => {
  it("maps the real fixture", () => {
    const res = parseMixapi(mixapiFixture)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.isLive).toBe(false)
    expect(res.data.maintenance).toBe(false)
    expect(res.data.feedVersions.fixtures).toMatch(/^\d{14}$/)
  })
})
