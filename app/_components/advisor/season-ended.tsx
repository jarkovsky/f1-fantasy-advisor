"use client"

import Link from "next/link"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

import { RosterRow } from "@/app/_components/shared/roster-row"

/**
 * SEASON_ENDED (spec §5.4): the final round is scored and there is no next
 * race. Read-only final squad, season points summary, and a link into the stats
 * explorer for the full review.
 */
type SeasonEndedProps = {
  roster: string[]
  assetsById: Record<string, AssetLite>
}

export function SeasonEnded({ roster, assetsById }: SeasonEndedProps) {
  const resolved = roster.map((id) => assetsById[id]).filter((a): a is AssetLite => a !== undefined)

  const seasonPoints = resolved.reduce((s, a) => s + a.seasonPoints, 0)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">That&apos;s a wrap on the 2026 season.</h1>

      <Card className="gap-3 bg-surface-1 p-4">
        <h2 className="text-sm font-semibold">Your final squad</h2>
        <ul className="flex flex-col gap-0.5">
          {resolved.map((a) => (
            <RosterRow
              key={a.playerId}
              color={teamColor(assetColorKey(a))}
              tla={a.tla}
              name={a.displayName}
            >
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatPriceTenths(a.priceTenths)}
              </span>
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">
                {a.seasonPoints}
              </span>
            </RosterRow>
          ))}
        </ul>
        <p className="border-t border-grid-line pt-2 font-mono text-sm tabular-nums">
          Season points {seasonPoints}
        </p>
      </Card>

      <Button asChild variant="ghost" className="self-start">
        <Link href="/stats">Season review in the stats explorer</Link>
      </Button>
    </div>
  )
}
