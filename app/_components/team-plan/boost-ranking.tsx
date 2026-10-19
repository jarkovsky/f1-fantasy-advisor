import type { TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { AssetLite } from "@/lib/asset-lite"

import { ChevronDown } from "lucide-react"

import { formatSignedPoints } from "@/lib/format"
import { cn } from "@/lib/utils"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { BoostBadge } from "./pick-card"

/** Collapsible list of the plan's drivers by projection desc, badging the Boost driver. */
export function BoostRanking({
  plan,
  assetsById,
  totals,
}: {
  plan: TeamPlan
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
}) {
  const boostDriverId = plan.boostDriverId
  const ranked = plan.driverIds
    .map((id) => ({
      id,
      name: assetsById[id]?.displayName ?? `Asset ${id}`,
      projected: totals[id] ?? 0,
    }))
    .sort((a, b) => b.projected - a.projected)
  return (
    <Collapsible className="rounded-xl bg-surface-1 shadow-xs ring-1 ring-grid-line">
      <h3 className="text-sm font-semibold">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-f1 [&[data-state=open]>svg]:rotate-180">
          Boost ranking
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform"
          />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="px-4 pb-4">
        <ul className="flex flex-col gap-1">
          {ranked.map((d) => {
            const isBoostDriver = d.id === boostDriverId
            return (
              <li
                key={d.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm",
                  isBoostDriver && "bg-surface-2"
                )}
              >
                <span
                  className={cn("flex min-w-0 items-center gap-2", isBoostDriver && "font-medium")}
                >
                  <span className="truncate">{d.name}</span>
                  {isBoostDriver && <BoostBadge />}
                </span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {formatSignedPoints(d.projected)}
                </span>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
