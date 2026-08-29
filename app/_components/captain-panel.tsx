"use client"

import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { formatSignedPoints } from "@/lib/format"
import type { OptimizerResult } from "@/lib/optimizer"
import { cn } from "@/lib/utils"

/**
 * DRS Boost ranking — the recommended plan's five drivers sorted by projection
 * descending. The marginal gain of boosting a driver equals that driver's own
 * projection, because DRS_BOOST_MULTIPLIER = 2 (×2 adds one extra copy of the
 * score), so each row's "+{proj}" doubles as the boost value. The top row is
 * the optimizer's chosen captain (result.best.captainId).
 */
type CaptainPanelProps = {
  result: OptimizerResult
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
}

export function CaptainPanel({
  result,
  assetsById,
  totals,
}: CaptainPanelProps) {
  const ranked = [...result.best.driverIds]
    .map((id) => ({
      id,
      name: assetsById[id]?.displayName ?? `Driver ${id}`,
      projected: totals[id] ?? 0,
    }))
    .sort((a, b) => b.projected - a.projected)

  return (
    <Card className="gap-3 bg-surface-1 p-4">
      <h2 className="text-sm font-semibold">DRS Boost ranking</h2>
      <ul className="flex flex-col gap-1">
        {ranked.map((d) => {
          const isCaptain = d.id === result.best.captainId
          return (
            <li
              key={d.id}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-sm",
                isCaptain && "bg-accent-f1-quiet"
              )}
            >
              <span className={cn("truncate", isCaptain && "font-medium")}>
                {isCaptain && (
                  <span className="mr-1.5 text-accent-f1" aria-hidden="true">
                    ★
                  </span>
                )}
                {d.name}
              </span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {formatSignedPoints(d.projected)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
