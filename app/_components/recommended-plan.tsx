"use client"

import type { WhatIfMode } from "@/app/_components/advisor-types"
import { Delta } from "@/app/_components/delta"
import { UnavailableAssetTile } from "@/app/_components/unavailable-asset-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { DRS_BOOST_MULTIPLIER, EXTRA_TRANSFER_PENALTY } from "@/lib/constants"
import { formatPriceTenths, formatSignedPoints } from "@/lib/format"
import type { OptimizerResult, TeamPlan } from "@/lib/optimizer"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

/**
 * The headline recommendation: the optimizer's global best squad, framed as a
 * set of out→in swaps versus the user's current team, with the penalty-inclusive
 * net gain, the transfer-penalty accounting, the post-transfer bank, and the
 * DRS Boost pick. In a what-if (Wildcard / Limitless) the plan is explicitly
 * hypothetical and offers no apply action.
 */
type RecommendedPlanProps = {
  result: OptimizerResult
  baseline: TeamPlan | null
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
  freeTransfers: number | "unlimited"
  whatIf: WhatIfMode
  unresolvedIds: string[]
  applied: boolean
  onApply: () => void
  onKeep: () => void
}

type Swap = { outId: string | null; inId: string | null }

/** Symmetric set diff between the current roster and the plan, by class. */
function diffSquad(
  baseline: TeamPlan | null,
  plan: TeamPlan
): { drivers: Swap[]; constructors: Swap[] } {
  const pair = (current: string[], next: string[]): Swap[] => {
    const outs = current.filter((id) => !next.includes(id))
    const ins = next.filter((id) => !current.includes(id))
    const rows: Swap[] = []
    const len = Math.max(outs.length, ins.length)
    for (let i = 0; i < len; i++) {
      rows.push({ outId: outs[i] ?? null, inId: ins[i] ?? null })
    }
    return rows
  }
  return {
    drivers: pair(baseline?.driverIds ?? [], plan.driverIds),
    constructors: pair(baseline?.constructorIds ?? [], plan.constructorIds),
  }
}

export function RecommendedPlan({
  result,
  baseline,
  assetsById,
  totals,
  freeTransfers,
  whatIf,
  unresolvedIds,
  applied,
  onApply,
  onKeep,
}: RecommendedPlanProps) {
  const { best } = result
  const baselineTotal = baseline?.projectedTotal ?? 0
  const netGain = best.score - baselineTotal

  const { drivers, constructors } = diffSquad(baseline, best)
  const swaps = [...drivers, ...constructors].filter(
    (s) => s.outId !== null || s.inId !== null
  )

  const free = freeTransfers === "unlimited" ? best.transfers : freeTransfers
  const extra = Math.max(0, best.transfers - (free || 0))
  const penaltyPts = extra * Math.abs(EXTRA_TRANSFER_PENALTY)

  const captainName = assetsById[best.captainId]?.displayName ?? "—"
  const captainProj = totals[best.captainId] ?? 0
  const captainBoost = captainProj * (DRS_BOOST_MULTIPLIER - 1)

  const isWhatIf = whatIf !== "none"
  const budgetNegative = best.budgetLeftTenths < 0

  const nameOf = (id: string): string =>
    assetsById[id]?.displayName ?? `Asset ${id}`
  const projOf = (id: string): number => totals[id] ?? 0
  const colorFor = (id: string): string => {
    const a = assetsById[id]
    return teamColor(a ? assetColorKey(a) : null)
  }

  return (
    <Card className="relative gap-4 overflow-hidden bg-surface-1 p-5">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] bg-accent-f1"
      />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Recommended plan</h2>
        <Badge variant="secondary">
          {best.transfers} transfer{best.transfers === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <Delta value={netGain} points className="font-mono text-3xl" />
        <p className="text-xs text-muted-foreground">
          vs keeping your current team
        </p>
      </div>

      {unresolvedIds.length > 0 && (
        <div className="flex flex-col gap-2">
          {unresolvedIds.map((id) => (
            <UnavailableAssetTile
              key={id}
              id={id}
              displayName={assetsById[id]?.displayName}
            />
          ))}
        </div>
      )}

      {swaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No changes — your current team is already optimal for this model.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {swaps.map((s, i) => {
            const swapDelta =
              (s.inId ? projOf(s.inId) : 0) - (s.outId ? projOf(s.outId) : 0)
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                {s.outId ? (
                  <span className="flex min-w-0 items-center gap-1.5 opacity-60">
                    <span
                      aria-hidden="true"
                      className="h-3 w-[3px] shrink-0 rounded-full"
                      style={{ background: colorFor(s.outId) }}
                    />
                    <span className="truncate text-muted-foreground line-through">
                      {nameOf(s.outId)}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
                {s.inId ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-3 w-[3px] shrink-0 rounded-full"
                      style={{ background: colorFor(s.inId) }}
                    />
                    <span className="truncate font-medium">
                      {nameOf(s.inId)}
                    </span>
                  </span>
                ) : (
                  <span className="flex-1 text-muted-foreground">—</span>
                )}
                <Delta value={swapDelta} points className="font-mono text-xs" />
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs">
        {extra > 0 ? (
          <span className="text-neg">
            {free} free + {extra} extra · −{penaltyPts} pts penalty
          </span>
        ) : (
          <span className="text-muted-foreground">
            Within your free transfers — no penalty.
          </span>
        )}
      </p>

      <p className="text-xs text-muted-foreground">
        Budget after:{" "}
        <span
          className={cn("font-mono tabular-nums", budgetNegative && "text-neg")}
        >
          {formatPriceTenths(best.budgetLeftTenths)}
        </span>
        {whatIf === "limitless" && " (Limitless ignores budget)"}
      </p>

      <div className="rounded-md bg-surface-2 p-3">
        <p className="text-sm font-medium">
          DRS Boost → {captainName}{" "}
          <span className="text-accent-f1">(×{DRS_BOOST_MULTIPLIER})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSignedPoints(captainBoost)} pts boosted
        </p>
        <p className="text-xs text-muted-foreground">
          Highest projected driver in this squad.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {isWhatIf ? (
          <Badge variant="outline" className="text-warn">
            Hypothetical — not saved
          </Badge>
        ) : applied ? (
          <Button type="button" variant="primary-f1" disabled>
            Plan applied ✓
          </Button>
        ) : (
          <Button type="button" variant="primary-f1" onClick={onApply}>
            Apply this plan
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onKeep}>
          Keep current team
        </Button>
      </div>
    </Card>
  )
}
