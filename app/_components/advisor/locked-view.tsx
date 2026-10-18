"use client"

import type { ProjectionResult } from "@/lib/projections/types/projection"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { pickBoostDriverId } from "@/lib/optimizer/boost"
import { BOOST_MULTIPLIER } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { LineupRow } from "@/app/_components/shared/lineup-row"

type LockedViewProps = {
  gpName: string
  live: boolean
  lineup: string[]
  assetsById: Record<string, AssetLite>
  projection: ProjectionResult
  nextLockAtMs: number | null
}

const lockFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
})

/**
 * LOCKED: the team is locked for the current weekend, so the advisor is
 * read-only. Projected points and the Boost pick come straight from the
 * stored lineup's projections (a plain sum plus the best-driver bonus — no
 * optimizer search, since nothing can change). When a later weekend exists,
 * the next lock time is shown.
 */
export function LockedView({
  gpName,
  live,
  lineup,
  assetsById,
  projection,
  nextLockAtMs,
}: LockedViewProps) {
  const resolved = lineup.map((id) => assetsById[id]).filter((a): a is AssetLite => a !== undefined)
  const projOf = (id: string): number => projection.byPlayerId[id]?.totalPoints ?? 0

  const boostDriverId = pickBoostDriverId(
    resolved.filter((a) => a.kind === "driver").map((d) => d.playerId),
    projOf
  )
  const boostDriver = boostDriverId ? assetsById[boostDriverId] : undefined
  const projectedSum = resolved.reduce((s, a) => s + projOf(a.playerId), 0)
  const boostBonus = boostDriver ? projOf(boostDriver.playerId) * (BOOST_MULTIPLIER - 1) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-4">
        <p className="font-medium">Team locked for the {gpName}.</p>
        {live && (
          <Badge variant="live" className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent-f1 motion-safe:animate-pulse"
            />
            Race weekend in progress
          </Badge>
        )}
      </div>

      <Card className="gap-3 bg-surface-1 p-4">
        <ul className="flex flex-col gap-0.5">
          {resolved.map((a) => (
            <LineupRow
              key={a.playerId}
              color={teamColor(assetColorKey(a))}
              tla={a.tla}
              name={a.displayName}
            >
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatPriceTenths(a.priceTenths)}
              </span>
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">
                {projOf(a.playerId).toFixed(1)}
              </span>
            </LineupRow>
          ))}
        </ul>
        <p className="border-t border-grid-line pt-2 font-mono text-sm tabular-nums">
          Projected {(projectedSum + boostBonus).toFixed(1)} pts · Boost{" "}
          {boostDriver?.displayName ?? "—"}
        </p>
      </Card>

      <p className="text-xs text-muted-foreground">
        Transfers reopen after the race.
        {nextLockAtMs !== null && <> Next lock: {lockFmt.format(nextLockAtMs)}.</>}
      </p>
    </div>
  )
}
