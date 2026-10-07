/**
 * 'server-only' cached fetchers for the F1 Fantasy feeds.
 *
 * Deliberately thin: all degradation logic lives in fetch-or-snapshot.ts
 * (unit-tested), all parsing in schemas.ts (unit-tested). These wrappers only
 * add Next 16 Cache Components directives — verified by typecheck + the
 * online/offline builds, not Vitest ('use cache' needs the Next runtime).
 *
 * Caching model (no feed sends Cache-Control — we own every TTL, profiles in
 * next.config.ts):
 * - completed races are immutable → 'driversCompleted' (max-like)
 * - current race / constraints → 5 min ('driversCurrent' / 'orchestration')
 * - raceday schedule → hourly; mixapi → 'mixapi' (minutes-like)
 *
 * M1 simplifications (deliberate): no client polling; no mixapi version-stamp
 * diffing (nothing to gate without polling); no conditional requests (ETag/304
 * pays off only with a persistent store — pair with 'use cache: remote' when
 * personalization arrives); serverless cold-lambda refetch is accepted
 * (~160KB total from a CDN, and the snapshot fallback makes failure harmless).
 */
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { fetchOrSnapshot, probeFeedPublished } from "./fetch-or-snapshot"
import { feedPaths } from "./config"
import {
  type Asset,
  type Mixapi,
  type RaceWeekConstraints,
  type RaceWeekend,
  parseConstraints,
  parseDriversFeed,
  parseMixapi,
  parseRaceday,
} from "./schemas"
import {
  snapshotConstraints,
  snapshotDrivers,
  snapshotMixapi,
  snapshotRaceday,
} from "./snapshot-data"
import { assembleHistory } from "./history"
import type { Feed } from "./types/feed"
import type { SeasonHistory } from "./types/history"

/**
 * One race's assets. The caller decides `completed` (race ≤
 * constraints.lastCompletedRace) — it already holds the constraints, and
 * primitive args keep the cache key clean. Completed races are immutable and
 * cache effectively forever.
 */
export async function getDrivers(race: number, completed: boolean): Promise<Feed<Asset[]>> {
  "use cache"
  cacheTag("f1", "f1:drivers", `f1:drivers:${race}`)
  // Branched (not a ternary argument): cacheLife is overloaded per profile
  // literal, and a union of two literals matches no single overload.
  if (completed) {
    cacheLife("driversCompleted")
  } else {
    cacheLife("driversCurrent")
  }
  return fetchOrSnapshot(
    feedPaths.drivers(race),
    parseDriversFeed,
    () => snapshotDrivers(race),
    { empty: [] },
    race
  )
}

/** Current race pointer, last completed race, budget cap. */
export async function getConstraints(): Promise<Feed<RaceWeekConstraints | null>> {
  "use cache"
  cacheTag("f1", "f1:constraints")
  cacheLife("orchestration")
  return fetchOrSnapshot(feedPaths.constraints(), parseConstraints, snapshotConstraints, {
    empty: null,
  })
}

/** The season schedule grouped into RaceWeekends (real locks live here). */
export async function getRaceday(): Promise<Feed<RaceWeekend[]>> {
  "use cache"
  cacheTag("f1", "f1:raceday")
  cacheLife("raceday")
  return fetchOrSnapshot(feedPaths.raceday(), parseRaceday, snapshotRaceday, {
    empty: [],
  })
}

/** Live flag + maintenance + feed version stamps. */
export async function getMixapi(): Promise<Feed<Mixapi | null>> {
  "use cache"
  cacheTag("f1", "f1:mixapi")
  cacheLife("mixapi")
  return fetchOrSnapshot(feedPaths.mixapi(), parseMixapi, snapshotMixapi, {
    empty: null,
  })
}

/**
 * Has the race AFTER currentRace been published yet?
 *
 * Status-only probe (probeFeedPublished) — getDrivers can't tell, it degrades
 * the unpublished-race 403 to the snapshot. Cheap to keep slightly stale:
 * publication flips at most twice a fortnight, so 5-min 'orchestration'
 * staleness is fine. Like the other wrappers, this is verified by
 * typecheck + the online/offline builds, not Vitest ('use cache' needs the
 * Next runtime).
 */
export async function getNextRacePublished(currentRace: number): Promise<boolean> {
  "use cache"
  cacheTag("f1", "f1:next-race-published")
  cacheLife("orchestration")
  return probeFeedPublished(feedPaths.drivers(currentRace + 1))
}

/**
 * Full season history: fan-out over races 1..upToRace, assembled into
 * per-asset series with RECOMPUTED cumulative points (the feed's own season
 * totals are contaminated by regeneration — see history.ts).
 *
 * The fan-out promises are created and awaited INSIDE this cache scope —
 * passing promises into a 'use cache' fn is the documented build-hang trap.
 * Two-level caching: each race is its own cache entry (completed ones at
 * 'max'), this aggregate refreshes with its freshest member.
 */
export async function getHistory(
  upToRace: number,
  lastCompletedRace: number
): Promise<Feed<SeasonHistory>> {
  "use cache"
  cacheTag("f1", "f1:history")
  cacheLife("driversCurrent")
  const feeds = await Promise.all(
    Array.from({ length: upToRace }, (_, i) => {
      const race = i + 1
      return getDrivers(race, race <= lastCompletedRace)
    })
  )
  const history = assembleHistory(feeds.map((f, i) => ({ raceNumber: i + 1, assets: f.data })))
  const degraded = feeds.some((f) => f.meta.source === "snapshot")
  return {
    data: history,
    meta: {
      source: degraded ? "snapshot" : "live",
      asOf: feeds.at(-1)?.meta.asOf ?? "",
    },
  }
}
