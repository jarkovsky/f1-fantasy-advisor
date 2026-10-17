import type { StatsRow } from "./stats-row"

import { getConstraints, getDrivers, getHistory } from "@/lib/f1/feed"
import { form5, sessionAvg } from "@/lib/profile/season-stats"
import { assetColorKey } from "@/lib/asset-lite"

import { StatsTable } from "./stats-table"
import { DataAsOf } from "./data-as-of"

/**
 * The /stats data hole: the page's one async RSC. It assembles the full
 * per-asset dataset on the server and ships a plain serializable StatsRow[] to
 * the <StatsTable> client island for instant in-browser sorting. Shipping the
 * whole dataset is deliberate — 33 assets × ≤22 races of numbers is well under
 * 100KB.
 */
export async function AssetTable() {
  const constraints = await getConstraints()
  // The cached fetchers key on primitive args, so resolve the race numbers first.
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
      hasProfile: asset.kind === "driver" && asset.active,
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
