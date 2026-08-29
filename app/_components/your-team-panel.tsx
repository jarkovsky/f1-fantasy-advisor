"use client"

import { UnavailableAssetTile } from "@/app/_components/unavailable-asset-tile"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { DRS_BOOST_MULTIPLIER } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

/**
 * The saved squad at a glance: seven timing rows (5 drivers + 2 constructors)
 * with team-color bars, prices, and projected points; a captain chip on the
 * best-projected driver; squad-value / projected-points footer; and a budget
 * bar (spent vs spent + bank). Edit launches the picker. Roster ids absent from
 * the feed render as unavailable tiles.
 */
type YourTeamPanelProps = {
  roster: string[]
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
  budgetTenths: number
  onEdit: () => void
}

export function YourTeamPanel({
  roster,
  assetsById,
  totals,
  budgetTenths,
  onEdit,
}: YourTeamPanelProps) {
  const resolved = roster
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)
  const unresolvedIds = roster.filter((id) => assetsById[id] === undefined)

  const drivers = resolved.filter((a) => a.kind === "driver")
  // Captain = best-projected resolved driver (ties → lower id, matching the
  // optimizer's rule).
  const captainId = [...drivers].sort((a, b) => {
    const d = (totals[b.playerId] ?? 0) - (totals[a.playerId] ?? 0)
    return d !== 0 ? d : a.playerId < b.playerId ? -1 : 1
  })[0]?.playerId

  const squadValueTenths = resolved.reduce((sum, a) => sum + a.priceTenths, 0)
  const projectedSum = resolved.reduce(
    (sum, a) => sum + (totals[a.playerId] ?? 0),
    0
  )
  const captainBonus =
    captainId !== undefined
      ? (totals[captainId] ?? 0) * (DRS_BOOST_MULTIPLIER - 1)
      : 0

  const purseTenths = squadValueTenths + budgetTenths
  const spentPct =
    purseTenths > 0 ? Math.min(100, (squadValueTenths / purseTenths) * 100) : 0

  return (
    <Card className="gap-3 bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your team</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit team
        </Button>
      </div>

      <ul className="flex flex-col gap-0.5">
        {resolved.map((a) => {
          const isCaptain = a.playerId === captainId
          return (
            <li
              key={a.playerId}
              className="flex items-center gap-2 py-1 text-sm"
            >
              <span
                aria-hidden="true"
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{ background: teamColor(assetColorKey(a)) }}
              />
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                {a.tla}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {a.displayName}
                {isCaptain && (
                  <span
                    className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-f1-quiet text-[10px] font-bold text-accent-f1"
                    aria-label="DRS Boost captain"
                    title="DRS Boost captain"
                  >
                    C
                  </span>
                )}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatPriceTenths(a.priceTenths)}
              </span>
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">
                {(totals[a.playerId] ?? 0).toFixed(1)}
              </span>
            </li>
          )
        })}
      </ul>

      {unresolvedIds.length > 0 && (
        <div className="flex flex-col gap-2">
          {unresolvedIds.map((id) => (
            <UnavailableAssetTile key={id} id={id} onReplace={onEdit} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-grid-line pt-2 text-sm">
        <span className="text-muted-foreground">
          Squad value {formatPriceTenths(squadValueTenths)}
        </span>
        <span className="font-mono tabular-nums">
          Projected {(projectedSum + captainBonus).toFixed(1)} pts
        </span>
      </div>

      <Progress
        value={spentPct}
        aria-label="Squad value as a share of your purse"
      />
    </Card>
  )
}
