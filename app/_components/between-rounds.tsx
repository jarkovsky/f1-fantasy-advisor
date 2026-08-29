"use client"

import { Delta } from "@/app/_components/delta"
import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { formatPoints } from "@/lib/format"
import type { TeamStateV1 } from "@/lib/store"

/**
 * BETWEEN_ROUNDS (spec §5.4): the last race is scored but the next drivers feed
 * is unpublished, so there is nothing to recommend yet (once it publishes the
 * machine flips to ROLLOVER automatically). We show honest results: what the
 * user scored versus what we projected, plus a per-asset actual-vs-projected
 * table. No roll-over CTA here — that belongs to ROLLOVER.
 */
type BetweenRoundsProps = {
  lastCompleted: number
  roster: string[]
  assetsById: Record<string, AssetLite>
  lastRacePoints: Record<string, number | null>
  savedProjection: TeamStateV1["savedProjection"]
}

export function BetweenRounds({
  lastCompleted,
  roster,
  assetsById,
  lastRacePoints,
  savedProjection,
}: BetweenRoundsProps) {
  const resolved = roster
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)

  const scored = roster.reduce((sum, id) => sum + (lastRacePoints[id] ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        Results are in for race {lastCompleted}.
      </h1>

      {savedProjection && (
        <Card className="gap-1 bg-surface-1 p-4">
          <p className="text-sm">
            You scored{" "}
            <span className="font-mono font-semibold tabular-nums">
              {scored}
            </span>{" "}
            · we projected{" "}
            <span className="font-mono tabular-nums">
              {savedProjection.totalPoints.toFixed(1)}
            </span>
          </p>
          <Delta
            value={scored - savedProjection.totalPoints}
            points
            className="font-mono text-sm"
          />
        </Card>
      )}

      <Card className="gap-3 bg-surface-1 p-4">
        <h2 className="text-sm font-semibold">Actual vs projected</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 text-left font-medium">Asset</th>
              <th className="py-1 text-right font-medium">Actual</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((a) => (
              <tr key={a.playerId} className="border-t border-grid-line/60">
                <td className="py-1">{a.displayName}</td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {formatPoints(lastRacePoints[a.playerId] ?? null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Next race not published yet — check back soon.
      </p>
    </div>
  )
}
