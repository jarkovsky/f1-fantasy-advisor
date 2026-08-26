// Shared parse path for component tests. The M3 component tests need the same
// real-feed domain models that lib/f1/raceweek.test.ts and history.test.ts
// build inline — but recreating those loaders per file would drift. This module
// centralizes them, running the slimmed __fixtures__ JSON (4 real assets ×
// 6 races + constraints/raceday/mixapi, captured 2026-06-05, race 6 pending)
// through the real parsers in lib/f1/schemas.ts. No hand-rolled literals: the
// fixtures are trusted, so a parse failure THROWS loudly rather than degrading.

import race1 from "@/lib/f1/__fixtures__/drivers.race1.json"
import race2 from "@/lib/f1/__fixtures__/drivers.race2.json"
import race3 from "@/lib/f1/__fixtures__/drivers.race3.json"
import race4 from "@/lib/f1/__fixtures__/drivers.race4.json"
import race5 from "@/lib/f1/__fixtures__/drivers.race5.json"
import race6 from "@/lib/f1/__fixtures__/drivers.race6.json"
import constraintsFixture from "@/lib/f1/__fixtures__/constraints.json"
import racedayFixture from "@/lib/f1/__fixtures__/raceday.excerpt.json"
import mixapiFixture from "@/lib/f1/__fixtures__/mixapi.json"
import { assembleHistory, type SeasonHistory } from "@/lib/f1/history"
import {
  type Asset,
  type Mixapi,
  type RaceWeekConstraints,
  type RaceWeekend,
  parseConstraints,
  parseDriversFeed,
  parseMixapi,
  parseRaceday,
} from "@/lib/f1/schemas"

const RACE_FIXTURES: Record<number, unknown> = {
  1: race1,
  2: race2,
  3: race3,
  4: race4,
  5: race5,
  6: race6,
}

/** Parsed assets for one race (4 real assets per the slimmed fixtures). */
export function fixtureAssets(race: number): Asset[] {
  const fixture = RACE_FIXTURES[race]
  if (fixture === undefined) {
    throw new Error(`no drivers fixture for race ${race}`)
  }
  const res = parseDriversFeed(fixture)
  if (!res.ok)
    throw new Error(`drivers.race${race} failed: ${res.summary.join("; ")}`)
  return res.data
}

/** Parsed constraints (raceNumber 6 in the fixtures). */
export function fixtureConstraints(): RaceWeekConstraints {
  const res = parseConstraints(constraintsFixture)
  if (!res.ok) throw new Error(`constraints failed: ${res.summary.join("; ")}`)
  return res.data
}

/** Parsed, grouped race weekends (includes raceNumber 6 and 7). */
export function fixtureWeekends(): RaceWeekend[] {
  const res = parseRaceday(racedayFixture)
  if (!res.ok) throw new Error(`raceday failed: ${res.summary.join("; ")}`)
  return res.data
}

/**
 * Assembled season history over races 1..upToRace (default 6). Race 6 is
 * pre-race/pending in the fixtures, so the default includes it as the pending
 * race excluded from cumulatives.
 */
export function fixtureHistory(upToRace = 6): SeasonHistory {
  const payloads = []
  for (let race = 1; race <= upToRace; race++) {
    payloads.push({ raceNumber: race, assets: fixtureAssets(race) })
  }
  return assembleHistory(payloads)
}

/** Parsed mixapi change-detector / live flag. */
export function fixtureMixapi(): Mixapi {
  const res = parseMixapi(mixapiFixture)
  if (!res.ok) throw new Error(`mixapi failed: ${res.summary.join("; ")}`)
  return res.data
}
