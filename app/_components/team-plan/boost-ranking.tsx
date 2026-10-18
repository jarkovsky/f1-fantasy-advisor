import { formatSignedPoints } from "@/lib/format"
import { cn } from "@/lib/utils"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

/** Collapsible list of the plan's drivers by projection desc, starring the Boost driver. */
export function BoostRanking({
  ranked,
  boostDriverId,
}: {
  ranked: { id: string; name: string; projected: number }[]
  boostDriverId: string
}) {
  return (
    <Collapsible className="rounded-lg border border-grid-line bg-surface-2/40">
      <h3 className="text-sm font-semibold">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-f1">
          Boost ranking
          <span aria-hidden="true" className="font-normal text-muted-foreground">
            ⌄
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="px-3 pb-3">
        <ul className="flex flex-col gap-1">
          {ranked.map((d) => {
            const isBoostDriver = d.id === boostDriverId
            return (
              <li
                key={d.id}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1 text-sm",
                  isBoostDriver && "bg-accent-f1-quiet"
                )}
              >
                <span className={cn("truncate", isBoostDriver && "font-medium")}>
                  {isBoostDriver && (
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
      </CollapsibleContent>
    </Collapsible>
  )
}
