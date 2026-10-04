"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { DRS_BOOST_MULTIPLIER } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import type { ProjectionResult } from "@/lib/projections"
import { teamColor } from "@/lib/team-colors"

/**
 * LOCKED state (spec §5.4): the team is locked for the current weekend, so the
 * advisor is read-only. Projected points and the DRS Boost pick are computed
 * directly from the STORED roster's projections (a plain sum plus the
 * best-driver bonus — no optimizer search; nothing can change). When a later
 * weekend exists, the next lock time is shown.
 */
type LockedViewProps = {
  gpName: string
  live: boolean
  roster: string[]
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

export function LockedView({
  gpName,
  live,
  roster,
  assetsById,
  projection,
  nextLockAtMs,
}: LockedViewProps) {
  const resolved = roster.map((id) => assetsById[id]).filter((a): a is AssetLite => a !== undefined)
  const projOf = (id: string): number => projection.byPlayerId[id]?.totalPoints ?? 0

  const drivers = resolved.filter((a) => a.kind === "driver")
  const captain = [...drivers].sort((a, b) => {
    const d = projOf(b.playerId) - projOf(a.playerId)
    return d !== 0 ? d : a.playerId < b.playerId ? -1 : 1
  })[0]
  const projectedSum = resolved.reduce((s, a) => s + projOf(a.playerId), 0)
  const captainBonus = captain ? projOf(captain.playerId) * (DRS_BOOST_MULTIPLIER - 1) : 0

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
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">
                {projOf(a.playerId).toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-grid-line pt-2 font-mono text-sm tabular-nums">
          Projected {(projectedSum + captainBonus).toFixed(1)} pts · DRS Boost{" "}
          {captain?.displayName ?? "—"}
        </p>
      </Card>

      <p className="text-xs text-muted-foreground">
        Transfers reopen after the race.
        {nextLockAtMs !== null && <> Next lock: {lockFmt.format(nextLockAtMs)}.</>}
      </p>
    </div>
  )
}
