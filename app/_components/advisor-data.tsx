import type { AssetLite } from "@/lib/asset-lite"
import type { Feed, FeedMeta } from "@/lib/f1/types/feed"
import {
  getConstraints,
  getDrivers,
  getHistory,
  getMixapi,
  getNextRacePublished,
  getRaceday,
} from "@/lib/f1/feed"
import type { Asset } from "@/lib/f1/schemas"
import { headshotPath } from "@/lib/headshots"
import { projectAssets } from "@/lib/projections/engine"
import type { ProjectionResult } from "@/lib/projections/types/projection"

import { AdvisorPanel } from "./advisor-panel"
import type { FeedProvenance } from "@/lib/advisor/types/contract"
import type { ConcretePresetId } from "@/lib/projections/types/presets"

/** The presets the server materializes; `custom-blend` is derived client-side. */
const CONCRETE_PRESETS: readonly ConcretePresetId[] = [
  "weighted-recent",
  "form-5",
  "season-average",
  "equal-ppm",
]

/**
 * Worst-of provenance across the feeds this page consumed. If ANY feed served
 * a snapshot, the page is degraded → report "snapshot" with the EARLIEST asOf
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
 * The advisor's single streamed data hole (plan D3): a fully cacheable async
 * RSC — NO searchParams, NO wall-clock. It fetches every feed, pre-computes the
 * concrete-preset projections, trims the grid to AssetLite, and ships the
 * serializable ingredients to the client island, which runs the §5.4 state
 * machine itself.
 */
export async function AdvisorData() {
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

  const [raceday, drivers, history, mixapi, nextRacePublished, lastRaceDrivers] = await Promise.all(
    [
      getRaceday(),
      getDrivers(r, r <= lastCompletedRace),
      getHistory(r, lastCompletedRace),
      getMixapi(),
      getNextRacePublished(r),
      lastCompletedRace >= 1 ? getDrivers(lastCompletedRace, true) : null,
    ]
  )

  const isSprint = raceday.data.find((w) => w.raceNumber === r)?.isSprint ?? false

  const projectionsByPreset = Object.fromEntries(
    CONCRETE_PRESETS.map((preset) => [
      preset,
      projectAssets(history.data, { isSprint }, { preset }),
    ])
  ) as Record<ConcretePresetId, ProjectionResult>

  const seasonByPlayerId = history.data.byPlayerId
  const assets: AssetLite[] = drivers.data.map((a: Asset) => ({
    playerId: a.playerId,
    kind: a.kind,
    displayName: a.displayName,
    fullName: a.fullName,
    tla: a.tla,
    priceTenths: a.priceTenths,
    prevPriceTenths: a.prevPriceTenths,
    selectedPercent: a.selectedPercent,
    captainSelectedPercent: a.captainSelectedPercent,
    constructorId: a.kind === "driver" ? a.constructorId : null,
    teamName: a.teamName,
    seasonPoints: seasonByPlayerId[a.playerId]?.cumulativePoints ?? 0,
    headshotPath: headshotPath(a.playerId),
  }))

  // Ships the whole grid (~33 numbers, <1KB) even though the client reads only
  // the ~7 roster ids. We cannot pre-filter to the roster here: the roster is
  // localStorage-only client state and must never leak into this cacheable RSC.
  const lastRacePoints: Record<string, number | null> = {}
  if (lastRaceDrivers) {
    for (const a of lastRaceDrivers.data) {
      lastRacePoints[a.playerId] = a.racePoints
    }
  }

  // Worst-of provenance across every consumed feed. lastRaceDrivers is
  // included only when present.
  const consumed: { meta: FeedMeta }[] = [
    constraints as Feed<unknown>,
    raceday,
    drivers,
    history,
    mixapi,
  ]
  if (lastRaceDrivers) consumed.push(lastRaceDrivers)
  const meta = worstOfMeta(consumed, drivers.meta.asOf)

  return (
    <AdvisorPanel
      constraints={constraints.data}
      raceWeekends={raceday.data}
      nextRacePublished={nextRacePublished}
      live={mixapi.data?.isLive ?? false}
      assets={assets}
      projectionsByPreset={projectionsByPreset}
      lastRacePoints={lastRacePoints}
      meta={meta}
    />
  )
}
