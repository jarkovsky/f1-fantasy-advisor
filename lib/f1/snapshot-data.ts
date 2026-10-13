/**
 * Typed access to the committed feed snapshots in data/ — the offline /
 * degradation fallback for every fetcher in feed.ts.
 *
 * Static JSON imports are the documented Next build-time pattern: the data is
 * bundled with the deploy (no fs tracing config) and available even when the
 * build machine has zero network.
 *
 * When `pnpm snapshot` captures a new race, add its import here —
 * snapshot-data.test.ts fails loudly if data/ and this map drift apart.
 */
import "server-only"

import type { Snapshot } from "./types/feed"

import constraintsRaw from "@/data/constraints.json"
import racedayRaw from "@/data/raceday.json"
import manifest from "@/data/manifest.json"
import mixapiRaw from "@/data/mixapi.json"
import race1 from "@/data/drivers/1.json"
import race2 from "@/data/drivers/2.json"
import race3 from "@/data/drivers/3.json"
import race4 from "@/data/drivers/4.json"
import race5 from "@/data/drivers/5.json"
import race6 from "@/data/drivers/6.json"
import race7 from "@/data/drivers/7.json"
import race8 from "@/data/drivers/8.json"

export const DRIVERS_RAW: Record<number, unknown> = {
  1: race1,
  2: race2,
  3: race3,
  4: race4,
  5: race5,
  6: race6,
  7: race7,
  8: race8,
}

type ManifestEntry = { lastModified: string | null; fetchedAt: string }

function asOf(file: string): string {
  const entry = (manifest as Record<string, ManifestEntry>)[file]
  return entry?.lastModified ?? entry?.fetchedAt ?? ""
}

export function snapshotDrivers(race: number): Snapshot | null {
  const raw = DRIVERS_RAW[race]
  if (raw === undefined) return null
  return { raw, asOf: asOf(`drivers/${race}.json`) }
}

export function snapshotConstraints(): Snapshot {
  return { raw: constraintsRaw, asOf: asOf("constraints.json") }
}

export function snapshotRaceday(): Snapshot {
  return { raw: racedayRaw, asOf: asOf("raceday.json") }
}

export function snapshotMixapi(): Snapshot {
  return { raw: mixapiRaw, asOf: asOf("mixapi.json") }
}
