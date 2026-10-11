"use client"

import { useState } from "react"

import { formatSignedPoints } from "@/lib/format"
import { cn } from "@/lib/utils"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

/** Collapsible list of the plan's drivers by projection desc, starring the captain. */
export function DrsBoostRanking({
  ranked,
  captainId,
}: {
  ranked: { id: string; name: string; projected: number }[]
  captainId: string
}) {
  const [rankOpen, setRankOpen] = useState(false)

  return (
    <Collapsible
      open={rankOpen}
      onOpenChange={setRankOpen}
      className="rounded-lg border border-grid-line bg-surface-2/40"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-f1">
        {/* Heading semantics live INSIDE the trigger so tests find the ranking
            either by role=heading or by the button's name. */}
        <h3 className="text-sm font-semibold">DRS Boost ranking</h3>
        <span aria-hidden="true" className="text-muted-foreground">
          ⌄
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <ul className="flex flex-col gap-1">
          {ranked.map((d) => {
            const isCaptain = d.id === captainId
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
      </CollapsibleContent>
    </Collapsible>
  )
}
