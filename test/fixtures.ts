// Shared fixture loaders, so every test that needs real-feed domain models
// builds them the same way instead of re-implementing (and drifting) a loader
// per file. Runs the slimmed __fixtures__ JSON (4 real assets × 6 races +
// constraints/raceday/mixapi, captured 2026-06-05, race 6 pending) through the
// real parsers in lib/f1/schemas.ts. No hand-rolled literals: the fixtures are
// trusted, so a parse failure throws loudly rather than degrading.

import type { SeasonHistory } from "@/lib/f1/types/history"

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
import constraintsFixture from "@/lib/f1/__fixtures__/constraints.json"
import racedayFixture from "@/lib/f1/__fixtures__/raceday.excerpt.json"
import mixapiFixture from "@/lib/f1/__fixtures__/mixapi.json"
import race1 from "@/lib/f1/__fixtures__/drivers.race1.json"
import race2 from "@/lib/f1/__fixtures__/drivers.race2.json"
import race3 from "@/lib/f1/__fixtures__/drivers.race3.json"
import race4 from "@/lib/f1/__fixtures__/drivers.race4.json"
import race5 from "@/lib/f1/__fixtures__/drivers.race5.json"
import race6 from "@/lib/f1/__fixtures__/drivers.race6.json"
import { assembleHistory } from "@/lib/f1/history"

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
  if (!res.ok) throw new Error(`drivers.race${race} failed: ${res.summary.join("; ")}`)
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
