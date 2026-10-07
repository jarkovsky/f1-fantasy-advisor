import { getConstraints, getDrivers, getHistory } from "@/lib/f1/feed"
import type { AssetHistory } from "@/lib/f1/types/history"
import { assetColorKey } from "@/lib/asset-lite"
import { DataAsOf } from "./data-as-of"
import { StatsTable, type StatsRow } from "./stats-table"

/**
 * /stats data hole (spec §5.3): the page's one async RSC. It assembles the full
 * per-asset dataset on the server and ships a plain serializable StatsRow[] to
 * the <StatsTable> client island for instant in-browser sorting. The dataset is
 * deliberately client-shipped — 33 assets × ≤22 races of numbers is well under
 * 100KB (README documents the tradeoff). Keeps the DataAsOf provenance banner.
 */
export async function AssetTable() {
  const constraints = await getConstraints()
  // Resolve the race number BEFORE the cached calls: primitive args only.
  const race = constraints.data?.raceNumber ?? 1
  const lastCompleted = constraints.data?.lastCompletedRace ?? 0
  const [feed, history] = await Promise.all([
    getDrivers(race, race <= lastCompleted),
    getHistory(race, lastCompleted),
  ])

  const rows: StatsRow[] = feed.data.map((asset) => {
    const hist = history.data.byPlayerId[asset.playerId]
    const seasonPoints = hist?.cumulativePoints ?? 0
    const priceDeltaTenths = hist?.priceDeltaTenths ?? 0
    const spark = hist?.cumulativeByRace.map((c) => c.cumulative) ?? []

    return {
      playerId: asset.playerId,
      kind: asset.kind,
      displayName: asset.displayName,
      tla: asset.tla,
      teamName: asset.teamName,
      colorKey: assetColorKey({
        kind: asset.kind,
        playerId: asset.playerId,
        // Constructors carry no constructorId; they join on their own playerId.
        constructorId: asset.kind === "driver" ? asset.constructorId : null,
      }),
      priceTenths: asset.priceTenths,
      priceDeltaTenths,
      seasonPoints,
      ppm: asset.priceTenths === 0 ? null : seasonPoints / (asset.priceTenths / 10),
      form5: form5(hist),
      qualiAvg: sessionAvg(hist, "Qualifying"),
      raceAvg: sessionAvg(hist, "Race"),
      sprintAvg: sessionAvg(hist, "Sprint Qualifying"),
      selectedPercent: asset.selectedPercent,
      captainSelectedPercent: asset.captainSelectedPercent,
      spark,
    }
  })

  const driverCount = rows.filter((r) => r.kind === "driver").length
  const constructorCount = rows.length - driverCount

  return (
    <div className="flex flex-col gap-3">
      <DataAsOf meta={feed.meta} />
      <StatsTable
        rows={rows}
        caption={`Race ${race} · ${driverCount} drivers + ${constructorCount} constructors · season-to-date through race ${lastCompleted}`}
      />
    </div>
  )
}

/** Mean of the last ≤5 SCORED per-race points; null when the asset has none. */
function form5(hist: AssetHistory | undefined): number | null {
  if (!hist) return null
  const scored = hist.perRace
    .filter((p) => p.status === "scored" && p.points !== null)
    .map((p) => p.points as number)
  if (scored.length === 0) return null
  const last = scored.slice(-5)
  return last.reduce((a, b) => a + b, 0) / last.length
}

/**
 * Mean of one session's points over the SCORED races where that session ran;
 * null when the session never occurred (e.g. Sprint Qualifying on a non-sprint
 * calendar, or pre-first-scored-race). A session present but null-pointed (pre-
 * race) is excluded by the scored filter.
 */
function sessionAvg(
  hist: AssetHistory | undefined,
  session: "Qualifying" | "Race" | "Sprint Qualifying"
): number | null {
  if (!hist) return null
  const values: number[] = []
  for (const race of hist.perRace) {
    if (race.status !== "scored") continue
    for (const sp of race.sessionPoints) {
      if (sp.session === session && sp.points !== null) values.push(sp.points)
    }
  }
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
