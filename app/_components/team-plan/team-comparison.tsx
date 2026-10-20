"use client"

import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { DriverProfile } from "@/lib/profile/types/profile"
import type { WhatIfMode } from "@/lib/advisor/types/contract"
import type { SlotRow } from "@/lib/team/team-diff"
import type { AssetLite } from "@/lib/asset-lite"

import { ArrowRight, Pencil } from "lucide-react"
import { useMemo } from "react"

import { ADDITIONAL_TRANSFER_PENALTY } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { slotRows } from "@/lib/team/team-diff"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { UnavailableAssetTile } from "@/app/_components/shared/unavailable-asset-tile"
import { Delta } from "@/app/_components/shared/delta"

import { FeaturedPick, type PickStatus, PickRow } from "./pick-card"

type TeamComparisonProps = {
  result: OptimizerResult
  baseline: TeamPlan | null
  assetsById: Record<string, AssetLite>
  driverProfiles: Record<string, DriverProfile>
  totals: Record<string, number>
  /** The selected model's projections, explained in each pick's tooltip. */
  projection: ProjectionResult
  /** The saved team's Remaining Cost Cap, before any of the plan's transfers. */
  remainingCostCapTenths: number
  freeTransfers: number | "unlimited"
  whatIf: WhatIfMode
  unresolvedIds: string[]
  applied: boolean
  onApply: () => void
  onEdit: () => void
}

/** The banner's headline, beside the signed gain. */
export const GAIN_HEADLINE = "projected points vs keeping your current team"

/** Rows shared by both columns and the gutter: header, 5 drivers, 2 constructors, footer. */
const GRID_ROWS = "row-span-9 grid grid-rows-subgrid"

/** The gutter cell beside one slot: an arrow and the swap's points delta, or a quiet rule. */
function SwapMarker({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <div className="flex items-center">
        <span className="h-px w-full bg-grid-line" />
      </div>
    )
  }
  return (
    <div className="relative flex flex-col items-center justify-center gap-1">
      <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-grid-line-strong" />
      <span className="relative flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <ArrowRight className="size-4" />
      </span>
      <Delta value={delta} points className="relative hidden font-mono text-xs sm:inline" />
    </div>
  )
}

/**
 * Where you are vs where the optimizer would take you: the two teams side by
 * side, the current one flat and the recommended one raised. The recommended
 * card leads with the payoff, highlighted: the projected points gained over
 * keeping the current team (net of any transfer penalty), opposite your
 * team's own projected total in the same type but grey. The footer holds the
 * Apply button with the transfer accounting under it.
 *
 * Both columns share one set of rows (CSS subgrid), so each slot's current
 * pick sits level with its recommended pick, and the gutter between them marks
 * every transfer with an arrow and its points swing. The rows follow your
 * team, by price (drivers, then constructors), so changing the projection
 * model never reorders it: only its numbers and the OUT tags move. A kept pick
 * sits beside itself; the incoming picks fill the leaving picks' rows, best
 * projection first. The first driver row is the featured card.
 *
 * The Boost badge follows the optimizer's own picks (baseline.boostDriverId on
 * the left, result.best.boostDriverId on the right), so it never disagrees
 * with the engine.
 */
export function TeamComparison({
  result,
  baseline,
  assetsById,
  driverProfiles,
  totals,
  projection,
  remainingCostCapTenths,
  freeTransfers,
  whatIf,
  unresolvedIds,
  applied,
  onApply,
  onEdit,
}: TeamComparisonProps) {
  const { best } = result
  const boostId = best.boostDriverId
  const currentBoostId = baseline?.boostDriverId ?? null
  const projOf = (id: string): number => totals[id] ?? 0

  const rows = useMemo(() => {
    const priceOf = (id: string) => assetsById[id]?.priceTenths ?? 0
    const byPrice = (a: string, b: string) => priceOf(b) - priceOf(a) || a.localeCompare(b)
    const slots = slotRows(baseline, best, {
      byCurrent: byPrice,
      byIncoming: (a, b) => (totals[b] ?? 0) - (totals[a] ?? 0) || byPrice(a, b),
    })
    return [...slots.drivers, ...slots.constructors]
  }, [assetsById, baseline, best, totals])

  const free = freeTransfers === "unlimited" ? best.transfers : freeTransfers
  const additional = Math.max(0, best.transfers - free)
  const penaltyPts = additional * Math.abs(ADDITIONAL_TRANSFER_PENALTY)
  const netGain = best.score - (baseline?.projectedTotal ?? 0)

  const currentValueTenths = baseline?.costTenths ?? 0
  const isWhatIf = whatIf !== "none"
  const overCostCap = best.remainingCostCapTenths < 0

  function cell(row: SlotRow, side: "current" | "recommended", index: number) {
    const id = side === "current" ? (row.outId ?? row.inId) : row.inId
    const status: PickStatus = row.outId === null ? "kept" : side === "current" ? "out" : "in"
    const boost = side === "current" ? id === currentBoostId : id === boostId
    const props = {
      asset: assetsById[id],
      id,
      projected: projOf(id),
      projection: projection.byPlayerId[id],
      status,
      boost,
    }
    return index === 0 ? (
      <FeaturedPick key={`${side}-${id}`} {...props} profile={driverProfiles[id]} />
    ) : (
      <PickRow key={`${side}-${id}`} {...props} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] grid-rows-[repeat(9,auto)] gap-y-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]">
        {/* Current team */}
        <section
          aria-labelledby="current-team-title"
          className={cn(
            GRID_ROWS,
            "col-start-1 row-start-1 rounded-xl bg-surface-1/50 p-2.5 ring-1 ring-grid-line sm:p-4"
          )}
        >
          <header className="flex flex-col gap-2 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="current-team-title" className="text-base font-semibold">
                Your team
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil data-icon="inline-start" aria-hidden="true" />
                Edit team
              </Button>
            </div>
            {/* Where you stand, in the same type as the gain opposite but grey and
                unboxed, so the recommended card's number is the one that stands
                out. py-2.5 matches the gain box, keeping both headers level. */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2.5">
              <span className="font-display text-4xl leading-none font-extrabold tracking-tight text-muted-foreground [font-stretch:80%] tabular-nums">
                {baseline ? baseline.projectedTotal.toFixed(1) : "—"}
              </span>
              <p className="text-xs font-medium text-balance text-muted-foreground sm:text-sm">
                projected points with this team
              </p>
            </div>
          </header>
          <ul className="row-span-7 grid grid-rows-subgrid">
            {rows.map((row, i) => cell(row, "current", i))}
          </ul>
          <footer className="flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground">
            <span>
              Team value{" "}
              <span className="font-mono text-foreground">
                {formatPriceTenths(currentValueTenths)}
              </span>
            </span>
            <span>
              Remaining Cost Cap{" "}
              <span className="font-mono text-foreground">
                {formatPriceTenths(remainingCostCapTenths)}
              </span>
            </span>
            <span>
              {freeTransfers === "unlimited" ? (
                "Unlimited transfers"
              ) : (
                <>
                  <span className="font-mono text-foreground">{freeTransfers}</span> free transfers
                </>
              )}
            </span>
          </footer>
        </section>

        {/* Gutter: one marker per slot, level with both columns' rows. */}
        <div aria-hidden="true" className={cn(GRID_ROWS, "col-start-2 row-start-1 px-1")}>
          <div />
          {rows.map((row) => (
            <SwapMarker
              key={`gutter-${row.inId}`}
              delta={row.outId === null ? null : projOf(row.inId) - projOf(row.outId)}
            />
          ))}
          <div />
        </div>

        {/* Recommended team */}
        <section
          aria-labelledby="recommended-team-title"
          className={cn(
            GRID_ROWS,
            "col-start-3 row-start-1 rounded-xl bg-surface-1 p-2.5 shadow-lg ring-1 ring-grid-line-strong sm:p-4"
          )}
        >
          <header className="flex flex-col gap-2 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="recommended-team-title" className="text-base font-semibold">
                Recommended team
              </h2>
              <Badge variant="secondary">
                {best.transfers} transfer{best.transfers === 1 ? "" : "s"}
              </Badge>
            </div>
            {/* The payoff, highlighted: points gained over keeping the team, net of any penalty. */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-pos-quiet px-3 py-2.5">
              <Delta
                value={netGain}
                points
                className="font-display text-4xl leading-none font-extrabold tracking-tight [font-stretch:80%]"
              />
              <p className="text-xs font-medium text-balance sm:text-sm">{GAIN_HEADLINE}</p>
            </div>
          </header>
          <ul className="row-span-7 grid grid-rows-subgrid">
            {rows.map((row, i) => cell(row, "recommended", i))}
          </ul>
          <footer className="flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground">
            <span>
              Team value{" "}
              <span className="font-mono text-foreground">
                {formatPriceTenths(best.costTenths)}
              </span>
            </span>
            <span>
              Remaining Cost Cap after{" "}
              <span className={cn("font-mono text-foreground", overCostCap && "text-neg")}>
                {formatPriceTenths(best.remainingCostCapTenths)}
              </span>
              {whatIf === "limitless" && " (Limitless: no cost cap)"}
            </span>
            <div className="pt-2">
              {isWhatIf ? (
                <Badge variant="outline" className="h-8 px-3 text-sm text-warn">
                  Hypothetical — not saved
                </Badge>
              ) : applied ? (
                <Button
                  type="button"
                  variant="primary-f1"
                  size="lg"
                  disabled
                  className="h-11 w-full text-base"
                >
                  Plan applied ✓
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary-f1"
                  size="lg"
                  onClick={onApply}
                  className="h-11 w-full text-base"
                >
                  Apply this plan
                </Button>
              )}
            </div>
            {/* How the transfers are paid for, under the action that makes them. */}
            <p className="pt-1">
              {best.transfers === 0 ? (
                "No changes — your current team is already optimal for this model."
              ) : additional > 0 ? (
                <span className="text-neg">
                  {free} free + {additional} additional · −{penaltyPts} pts penalty included
                </span>
              ) : (
                "Within your free transfers — no penalty."
              )}
            </p>
          </footer>
        </section>
      </div>

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
    </div>
  )
}
