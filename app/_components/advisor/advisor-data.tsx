import type { ConcretePresetId } from "@/lib/projections/types/presets"
import type { FeedProvenance } from "@/lib/advisor/types/contract"
import type { FeedMeta } from "@/lib/f1/types/feed"
import type { AssetLite } from "@/lib/asset-lite"

import { getConstraints, getDrivers, getHistory, getMixapi, getRaceday } from "@/lib/f1/feed"
import { buildDriverProfiles } from "@/lib/profile/build-profiles"
import { projectAssetsMany } from "@/lib/projections/engine"
import { carNumber, headshotPath } from "@/lib/headshots"
import { teamLogo } from "@/lib/team-logos"

import { AdvisorPanel } from "./advisor-panel"

/** The presets the server materializes; `custom-blend` is derived client-side. */
const CONCRETE_PRESETS: readonly ConcretePresetId[] = [
  "weighted-recent",
  "form-5",
  "season-average",
  "equal-ppm",
]

/**
 * Worst-of provenance across the feeds this page consumed. If any feed served
 * a snapshot, the page is degraded: report "snapshot" with the earliest asOf
 * among the snapshot feeds (the staleness the user is actually exposed to).
 * Otherwise live, stamped with the current drivers feed's asOf.
 */
function worstOfMeta(feeds: readonly { meta: FeedMeta }[], liveAsOf: string): FeedProvenance {
  const snapshots = feeds.filter((f) => f.meta.source === "snapshot")
  if (snapshots.length === 0) return { source: "live", asOf: liveAsOf }

  // Earliest non-empty asOf; '' (unknown) sorts last so a known date wins.
  let earliest = ""
  for (const f of snapshots) {
    const asOf = f.meta.asOf
    if (!asOf) continue
    if (earliest === "" || Date.parse(asOf) < Date.parse(earliest)) {
      earliest = asOf
    }
  }
  return { source: "snapshot", asOf: earliest }
}

/**
 * The advisor's single streamed data hole: a fully cacheable async RSC — no
 * searchParams, no wall clock. It fetches every feed, pre-computes the
 * concrete-preset projections, trims the grid to AssetLite, and ships the
 * serializable ingredients to the client island, which runs the race-week
 * state machine itself.
 */
export async function AdvisorData() {
  // raceday and mixapi take no arguments and do not depend on constraints —
  // start them immediately so all three fetches run concurrently instead of
  // waiting for the constraints round-trip. Safe to leave floating on the
  // early-return path: fetchOrSnapshot provably never rejects.
  const racedayPromise = getRaceday()
  const mixapiPromise = getMixapi()

  const constraints = await getConstraints()
  if (!constraints.data) {
    return (
      <div className="rounded-xl border border-grid-line bg-surface-1 p-6 text-sm text-muted-foreground">
        Constraints feed unavailable — try again shortly.
      </div>
    )
  }

  const r = constraints.data.raceNumber
  const lastCompletedRace = constraints.data.lastCompletedRace

  const [drivers, history, lastRaceDrivers] = await Promise.all([
    getDrivers(r, r <= lastCompletedRace),
    getHistory(r, lastCompletedRace),
    lastCompletedRace >= 1 ? getDrivers(lastCompletedRace, true) : null,
  ])
  const raceday = await racedayPromise
  const mixapi = await mixapiPromise

  const isSprint = raceday.data.find((w) => w.raceNumber === r)?.isSprint ?? false

  const projectionsByPreset = projectAssetsMany(history.data, { isSprint }, CONCRETE_PRESETS)

  const seasonByPlayerId = history.data.byPlayerId
  const assets: AssetLite[] = drivers.data.map((a) => ({
    playerId: a.playerId,
    kind: a.kind,
    displayName: a.displayName,
    fullName: a.fullName,
    tla: a.tla,
    priceTenths: a.priceTenths,
    prevPriceTenths: a.prevPriceTenths,
    selectedPercent: a.selectedPercent,
    boostedPercent: a.boostedPercent,
    constructorId: a.kind === "driver" ? a.constructorId : null,
    teamName: a.teamName,
    seasonPoints: seasonByPlayerId[a.playerId]?.cumulativePoints ?? 0,
    headshotPath: headshotPath(a.playerId),
    logo: teamLogo(a.kind === "constructor" ? a.playerId : a.constructorId),
  }))

  const driverProfiles = buildDriverProfiles(drivers.data, history.data, (d) => ({
    headshotPath: headshotPath(d.playerId),
    carNumber: carNumber(d.playerId),
    teamLogo: teamLogo(d.constructorId),
  }))

  // Ships the whole grid (~33 numbers, <1KB) even though the client reads only
  // the ~7 lineup ids. We cannot pre-filter to the lineup here: the lineup is
  // localStorage-only client state and must never leak into this cacheable RSC.
  const lastRacePoints: Record<string, number | null> = {}
  if (lastRaceDrivers) {
    for (const a of lastRaceDrivers.data) {
      lastRacePoints[a.playerId] = a.racePoints
    }
  }

  const consumed: { meta: FeedMeta }[] = [constraints, raceday, drivers, history, mixapi]
  if (lastRaceDrivers) consumed.push(lastRaceDrivers)
  const meta = worstOfMeta(consumed, drivers.meta.asOf)

  return (
    <AdvisorPanel
      constraints={constraints.data}
      raceWeekends={raceday.data}
      live={mixapi.data?.isLive ?? false}
      assets={assets}
      projectionsByPreset={projectionsByPreset}
      driverProfiles={driverProfiles}
      lastRacePoints={lastRacePoints}
      meta={meta}
    />
  )
}
