"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

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
            <li key={a.playerId} className="flex items-center gap-2 py-1 text-sm">
              <span
                aria-hidden="true"
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{ background: teamColor(assetColorKey(a)) }}
              />
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{a.tla}</span>
              <span className="min-w-0 flex-1 truncate">{a.displayName}</span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatPriceTenths(a.priceTenths)}
              </span>
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">
                {a.seasonPoints}
              </span>
            </li>
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
