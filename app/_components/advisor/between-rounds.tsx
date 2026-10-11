"use client"

import type { TeamStateV1 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { formatPoints } from "@/lib/format"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"

import { NumCell } from "@/app/_components/shared/num-cell"
import { Delta } from "@/app/_components/shared/delta"

/**
 * BETWEEN_ROUNDS (spec §5.4): the last race is scored but the next drivers feed
 * is unpublished, so there is nothing to recommend yet (once it publishes the
 * machine flips to ROLLOVER automatically). We show honest results: what the
 * user scored versus what we projected, plus a per-asset actual-vs-projected
 * table. No roll-over CTA here — that belongs to ROLLOVER.
 *
 * Transient-window honesty: the state machine derives `lastCompleted` from the
 * wall clock (race end crossed), but the server's points map belongs to
 * `pointsRace` (constraints.lastCompletedRace), which lags until the feed
 * rescores. In the hours after a race ends those disagree — showing the OLD
 * race's numbers under the NEW race's headline would be a lie, so the
 * comparison renders only when the races match.
 */
type BetweenRoundsProps = {
  lastCompleted: number
  /** Which race the lastRacePoints map belongs to (server-side pointer). */
  pointsRace: number | null
  roster: string[]
  assetsById: Record<string, AssetLite>
  lastRacePoints: Record<string, number | null>
  savedProjection: TeamStateV1["savedProjection"]
}

export function BetweenRounds({
  lastCompleted,
  pointsRace,
  roster,
  assetsById,
  lastRacePoints,
  savedProjection,
}: BetweenRoundsProps) {
  const resolved = roster.map((id) => assetsById[id]).filter((a): a is AssetLite => a !== undefined)

  const scored = roster.reduce((sum, id) => sum + (lastRacePoints[id] ?? 0), 0)
  const pointsMatch = pointsRace === lastCompleted

  if (!pointsMatch) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Race {lastCompleted} has finished.</h1>
        <p className="text-sm text-muted-foreground">
          Results are still being scored — check back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Results are in for race {lastCompleted}.</h1>

      {savedProjection && (
        <Card className="gap-1 bg-surface-1 p-4">
          <p className="text-sm">
            You scored <span className="font-mono font-semibold tabular-nums">{scored}</span> · we
            projected{" "}
            <span className="font-mono tabular-nums">{savedProjection.totalPoints.toFixed(1)}</span>
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
        <Table>
          <TableHeader>
            <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
              <TableHead className="text-left font-medium">Asset</TableHead>
              <TableHead className="text-right font-medium">Actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolved.map((a) => (
              <TableRow key={a.playerId} className="border-grid-line/60 hover:bg-transparent">
                <TableCell>{a.displayName}</TableCell>
                <NumCell>{formatPoints(lastRacePoints[a.playerId] ?? null)}</NumCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Next race not published yet — check back soon.
      </p>
    </div>
  )
}
