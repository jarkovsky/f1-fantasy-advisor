"use client"

import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { DriverProfile } from "@/lib/profile/types/profile"
import type { WhatIfMode } from "@/lib/advisor/types/contract"
import type { SlotRow } from "@/lib/team/team-diff"
import type { AssetLite } from "@/lib/asset-lite"

import { ArrowRight, Pencil } from "lucide-react"
import { useMemo } from "react"

import { ADDITIONAL_TRANSFER_PENALTY } from "@/lib/constants"
import { diffTeam, slotRows } from "@/lib/team/team-diff"
import { formatPriceTenths } from "@/lib/format"
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </span>
  )
}

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
 * Where you are vs where the optimizer would take you. A banner leads with
 * the payoff: the projected points gained over keeping the current team (net
 * of any transfer penalty), how the transfers are paid for, and the Apply
 * button. Below it the two teams sit side by side, the current one flat and
 * the recommended one raised. Both columns share one set of rows (CSS
 * subgrid), so each slot's current pick sits level with its recommended pick,
 * and the gutter between them marks every transfer with an arrow and its
 * points swing. The slot holding the recommended Boost driver leads both
 * columns as the featured card; the other drivers and the constructors follow
 * by projection.
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
    const slots = slotRows(baseline, best, diffTeam(baseline, best))
    const byProjection = (a: SlotRow, b: SlotRow) => (totals[b.inId] ?? 0) - (totals[a.inId] ?? 0)
    const drivers = [...slots.drivers].sort((a, b) =>
      a.inId === boostId ? -1 : b.inId === boostId ? 1 : byProjection(a, b)
    )
    return [...drivers, ...[...slots.constructors].sort(byProjection)]
  }, [baseline, best, boostId, totals])

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
    const props = { asset: assetsById[id], id, projected: projOf(id), status, boost }
    return index === 0 ? (
      <FeaturedPick key={`${side}-${id}`} {...props} profile={driverProfiles[id]} />
    ) : (
      <PickRow key={`${side}-${id}`} {...props} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Projected gain"
        className="flex flex-col gap-4 rounded-xl bg-surface-1 p-4 shadow-xs ring-1 ring-grid-line sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Delta
              value={netGain}
              points
              className="font-display text-5xl leading-none font-extrabold tracking-tight [font-stretch:80%] sm:text-6xl"
            />
            <p className="text-base font-medium text-balance">{GAIN_HEADLINE}</p>
          </div>
          <div className="flex flex-col gap-0.5 text-sm">
            {best.transfers === 0 && (
              <span className="text-muted-foreground">
                No changes — your current team is already optimal for this model.
              </span>
            )}
            {best.transfers > 0 &&
              (additional > 0 ? (
                <span className="text-neg">
                  {free} free + {additional} additional · −{penaltyPts} pts penalty, already counted
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Within your free transfers — no penalty.
                </span>
              ))}
          </div>
        </div>
        <div className="shrink-0">
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
              className="h-12 w-full px-6 text-base sm:w-auto"
            >
              Plan applied ✓
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary-f1"
              size="lg"
              onClick={onApply}
              className="h-12 w-full px-6 text-base sm:w-auto"
            >
              Apply this plan
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] grid-rows-[repeat(9,auto)] gap-y-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]">
        {/* Current team */}
        <section
          aria-labelledby="current-team-title"
          className={cn(
            GRID_ROWS,
            "col-start-1 row-start-1 rounded-xl bg-surface-1/50 p-2.5 ring-1 ring-grid-line sm:p-4"
          )}
        >
          <header className="flex flex-wrap items-start justify-between gap-2 pb-1">
            <div className="flex flex-col gap-1">
              <Label>Now</Label>
              <h2 id="current-team-title" className="text-base font-semibold">
                Your team
              </h2>
              {baseline && (
                <p className="text-xs text-muted-foreground">
                  Projected{" "}
                  <span className="font-mono text-foreground">
                    {baseline.projectedTotal.toFixed(1)}
                  </span>{" "}
                  pts
                </p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil data-icon="inline-start" aria-hidden="true" />
              Edit team
            </Button>
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
          <header className="flex flex-col gap-1 pb-1">
            <Label>After transfers</Label>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="recommended-team-title" className="text-base font-semibold">
                Recommended team
              </h2>
              <Badge variant="secondary">
                {best.transfers} transfer{best.transfers === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Projected{" "}
              <span className="font-mono text-foreground">{best.projectedTotal.toFixed(1)}</span>{" "}
              pts
            </p>
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
