"use client"

import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"

import { useMemo } from "react"

import { BOOST_MULTIPLIER, ADDITIONAL_TRANSFER_PENALTY } from "@/lib/constants"
import { formatPriceTenths, formatSignedPoints } from "@/lib/format"
import { diffTeam, slotRows } from "@/lib/team/team-diff"
import { cn } from "@/lib/utils"

import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { UnavailableAssetTile } from "@/app/_components/shared/unavailable-asset-tile"
import { Delta } from "@/app/_components/shared/delta"

import { LineupPlanRow } from "./lineup-plan-row"
import { BoostRanking } from "./boost-ranking"

/**
 * The "Recommended team" card: the recommended team rendered in place, where kept slots
 * are plain lineup rows and swapped slots show out→in with the per-swap delta
 * (LineupPlanRow). The Boost badge and Boost summary follow the optimizer's
 * Boost driver (result.best.boostDriverId) rather than a locally derived one, so the card
 * never disagrees with the engine.
 */
type TeamPlanCardProps = {
  result: OptimizerResult
  baseline: TeamPlan | null
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
  freeTransfers: number | "unlimited"
  whatIf: WhatIfMode
  unresolvedIds: string[]
  applied: boolean
  onApply: () => void
  onEdit: () => void
}

export function TeamPlanCard({
  result,
  baseline,
  assetsById,
  totals,
  freeTransfers,
  whatIf,
  unresolvedIds,
  applied,
  onApply,
  onEdit,
}: TeamPlanCardProps) {
  const { best } = result
  const baselineTotal = baseline?.projectedTotal ?? 0
  const netGain = best.score - baselineTotal

  const diff = useMemo(() => diffTeam(baseline, best), [baseline, best])
  const swaps = useMemo(
    () =>
      [...diff.drivers, ...diff.constructors].filter((s) => s.outId !== null || s.inId !== null),
    [diff]
  )
  const { drivers: driverRows, constructors: constructorRows } = useMemo(
    () => slotRows(baseline, best, diff),
    [baseline, best, diff]
  )

  const free = freeTransfers === "unlimited" ? best.transfers : freeTransfers
  const additional = Math.max(0, best.transfers - free)
  const penaltyPts = additional * Math.abs(ADDITIONAL_TRANSFER_PENALTY)

  const boostDriverName = assetsById[best.boostDriverId]?.displayName ?? "—"
  const boostDriverProj = totals[best.boostDriverId] ?? 0
  const boostPoints = boostDriverProj * (BOOST_MULTIPLIER - 1)

  const isWhatIf = whatIf !== "none"
  const overCostCap = best.remainingCostCapTenths < 0

  // Cost Cap bar: the recommended team's value as a share of its cost cap (team
  // cost + the plan's Remaining Cost Cap). That equals the user's total cost cap, since
  // transfers never change the total money available.
  const teamValueTenths = best.costTenths
  const costCapTenths = teamValueTenths + best.remainingCostCapTenths
  const spentPct = costCapTenths > 0 ? Math.min(100, (teamValueTenths / costCapTenths) * 100) : 0

  const ranked = useMemo(
    () =>
      best.driverIds
        .map((id) => ({
          id,
          name: assetsById[id]?.displayName ?? `Asset ${id}`,
          projected: totals[id] ?? 0,
        }))
        .sort((a, b) => b.projected - a.projected),
    [best, totals, assetsById]
  )

  return (
    <Card className="relative gap-4 overflow-hidden bg-surface-1 p-5">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-accent-f1" />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Recommended team</h2>
        <Badge variant="secondary">
          {best.transfers} transfer{best.transfers === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <Delta value={netGain} points className="font-mono text-3xl" />
        <p className="text-xs text-muted-foreground">vs keeping your current team</p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {[...driverRows, ...constructorRows].map((row) => (
          <LineupPlanRow
            key={row.inId}
            row={row}
            boostDriverId={best.boostDriverId}
            assetsById={assetsById}
            totals={totals}
          />
        ))}
      </ul>

      {unresolvedIds.length > 0 && (
        <div className="flex flex-col gap-2">
          {unresolvedIds.map((id) => (
            <UnavailableAssetTile
              key={id}
              id={id}
              displayName={assetsById[id]?.displayName}
              onReplace={onEdit}
            />
          ))}
        </div>
      )}

      {swaps.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No changes — your current team is already optimal for this model.
        </p>
      )}

      <p className="text-xs">
        {additional > 0 ? (
          <span className="text-neg">
            {free} free + {additional} additional · −{penaltyPts} pts penalty
          </span>
        ) : (
          <span className="text-muted-foreground">Within your free transfers — no penalty.</span>
        )}
      </p>

      <p className="text-xs text-muted-foreground">
        Remaining Cost Cap after:{" "}
        <span className={cn("font-mono tabular-nums", overCostCap && "text-neg")}>
          {formatPriceTenths(best.remainingCostCapTenths)}
        </span>
        {whatIf === "limitless" && " (Limitless: no cost cap)"}
      </p>

      <Progress value={spentPct} aria-label="Team value as a share of your Cost Cap" />

      <div className="rounded-md bg-surface-2 p-3">
        <p className="text-sm font-medium">
          Boost → {boostDriverName}{" "}
          {/* Warn, not red: red small text fails AA contrast on the raised
              surface, and red is reserved for the primary action and deltas. */}
          <span className="text-warn">(x{BOOST_MULTIPLIER})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSignedPoints(boostPoints)} pts boosted
        </p>
        <p className="text-xs text-muted-foreground">Highest projected driver in this team.</p>
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
      </div>

      <BoostRanking ranked={ranked} boostDriverId={best.boostDriverId} />
    </Card>
  )
}
