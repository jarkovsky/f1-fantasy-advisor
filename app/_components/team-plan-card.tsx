"use client"

import { useState } from "react"

import type { WhatIfMode } from "@/app/_components/advisor-types"
import { Delta } from "@/app/_components/delta"
import { UnavailableAssetTile } from "@/app/_components/unavailable-asset-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { DRS_BOOST_MULTIPLIER, EXTRA_TRANSFER_PENALTY } from "@/lib/constants"
import { formatPriceTenths, formatSignedPoints } from "@/lib/format"
import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

/**
 * The single merged "Your team" card (spec §10 M5, user-driven redesign): the
 * old your-team-panel + recommended-plan + captain-panel folded into ONE Card so
 * the advisor reads as one centered column instead of a two-pane command center.
 *
 * The novelty is the roster: instead of showing the CURRENT squad plus a
 * separate swap list, this renders the RECOMMENDED squad in place — kept slots
 * look like the old your-team rows; swapped slots show out→in inline with the
 * per-swap delta. The DRS chip and DRS-Boost summary follow the optimizer's
 * captain (result.best.captainId), not a locally-derived one, so the card never
 * disagrees with the engine.
 */
type TeamPlanCardProps = {
  roster: string[]
  result: OptimizerResult
  baseline: TeamPlan | null
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
  budgetTenths: number
  freeTransfers: number | "unlimited"
  whatIf: WhatIfMode
  unresolvedIds: string[]
  applied: boolean
  onApply: () => void
  onKeep: () => void
  onEdit: () => void
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

/**
 * Recommended-squad rows, by class. A slot is a "kept" row when its in-asset is
 * also in the baseline (no swap); otherwise it carries the matching out→in swap
 * so the same row shows both the departing and arriving asset. When there is no
 * baseline (no valid current team) every plan id is a plain kept-style row.
 */
type SlotRow = { inId: string; outId: string | null }

function slotRows(
  baseline: TeamPlan | null,
  plan: TeamPlan,
  swaps: { drivers: Swap[]; constructors: Swap[] }
): { drivers: SlotRow[]; constructors: SlotRow[] } {
  const build = (
    planIds: string[],
    baselineIds: string[] | undefined,
    classSwaps: Swap[]
  ): SlotRow[] => {
    // Incoming ids (in the plan, not in the baseline), each paired with the
    // matching outgoing id from the symmetric diff so the row can render out→in.
    const incoming = baselineIds ? planIds.filter((id) => !baselineIds.includes(id)) : []
    const outsForIn = new Map<string, string | null>()
    for (const s of classSwaps) {
      if (s.inId !== null) outsForIn.set(s.inId, s.outId)
    }
    return planIds.map((id) => ({
      inId: id,
      outId: incoming.includes(id) ? (outsForIn.get(id) ?? null) : null,
    }))
  }
  return {
    drivers: build(plan.driverIds, baseline?.driverIds, swaps.drivers),
    constructors: build(plan.constructorIds, baseline?.constructorIds, swaps.constructors),
  }
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
  onKeep,
  onEdit,
}: TeamPlanCardProps) {
  const { best } = result
  const baselineTotal = baseline?.projectedTotal ?? 0
  const netGain = best.score - baselineTotal

  const diff = diffSquad(baseline, best)
  const swaps = [...diff.drivers, ...diff.constructors].filter(
    (s) => s.outId !== null || s.inId !== null
  )
  const { drivers: driverRows, constructors: constructorRows } = slotRows(baseline, best, diff)

  const free = freeTransfers === "unlimited" ? best.transfers : freeTransfers
  const extra = Math.max(0, best.transfers - (free || 0))
  const penaltyPts = extra * Math.abs(EXTRA_TRANSFER_PENALTY)

  const captainName = assetsById[best.captainId]?.displayName ?? "—"
  const captainProj = totals[best.captainId] ?? 0
  const captainBoost = captainProj * (DRS_BOOST_MULTIPLIER - 1)

  const isWhatIf = whatIf !== "none"
  const budgetNegative = best.budgetLeftTenths < 0

  // Budget bar: the recommended squad's value as a share of its own purse
  // (squad cost + the leftover bank the plan reports — identical to the user's
  // total purse, since a transfer never changes the total money on the table).
  const squadValueTenths = best.costTenths
  const purseTenths = squadValueTenths + best.budgetLeftTenths
  const spentPct = purseTenths > 0 ? Math.min(100, (squadValueTenths / purseTenths) * 100) : 0

  const nameOf = (id: string): string => assetsById[id]?.displayName ?? `Asset ${id}`
  const tlaOf = (id: string): string => assetsById[id]?.tla ?? "—"
  const priceOf = (id: string): number => assetsById[id]?.priceTenths ?? 0
  const projOf = (id: string): number => totals[id] ?? 0
  const colorFor = (id: string): string => {
    const a = assetsById[id]
    return teamColor(a ? assetColorKey(a) : null)
  }

  // DRS Boost ranking — the plan's five drivers by projection desc.
  const ranked = [...best.driverIds]
    .map((id) => ({ id, name: nameOf(id), projected: projOf(id) }))
    .sort((a, b) => b.projected - a.projected)

  const [rankOpen, setRankOpen] = useState(false)

  /** Per-class roster rows. A kept slot is the old your-team row; a swapped slot
   *  renders out→in inline with the per-swap delta. */
  function renderRows(rows: SlotRow[]) {
    return rows.map((row) => {
      const isCaptain = row.inId === best.captainId
      const captainChip = isCaptain && (
        <span
          className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-f1-quiet text-[10px] font-bold text-accent-f1"
          aria-label="DRS Boost captain"
          title="DRS Boost captain"
        >
          C
        </span>
      )

      if (row.outId === null) {
        // Kept row — mirrors the old your-team layout (no line-through).
        return (
          <li key={row.inId} className="flex items-center gap-2 py-1 text-sm">
            <span
              aria-hidden="true"
              className="h-4 w-[3px] shrink-0 rounded-full"
              style={{ background: colorFor(row.inId) }}
            />
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
              {tlaOf(row.inId)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {nameOf(row.inId)}
              {captainChip}
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
              {formatPriceTenths(priceOf(row.inId))}
            </span>
            <span className="w-12 shrink-0 text-right font-mono tabular-nums">
              {projOf(row.inId).toFixed(1)}
            </span>
          </li>
        )
      }

      // Swapped row: out → in, inline per-swap delta.
      const swapDelta = projOf(row.inId) - projOf(row.outId)
      return (
        <li key={row.inId} className="flex items-center gap-2 py-1 text-sm">
          {/* Muted color + strikethrough mark the outgoing asset; NO opacity
              on the text wrapper — stacking it under muted-foreground fails
              WCAG AA contrast (caught by the M4 Lighthouse pass). */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-[3px] shrink-0 rounded-full opacity-60"
              style={{ background: colorFor(row.outId) }}
            />
            <span className="truncate text-muted-foreground line-through">{nameOf(row.outId)}</span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-[3px] shrink-0 rounded-full"
              style={{ background: colorFor(row.inId) }}
            />
            <span className="truncate font-medium">
              {nameOf(row.inId)}
              {captainChip}
            </span>
          </span>
          <Delta value={swapDelta} points className="font-mono text-xs" />
        </li>
      )
    })
  }

  return (
    <Card className="relative gap-4 overflow-hidden bg-surface-1 p-5">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-accent-f1" />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Your team</h2>
        <Badge variant="secondary">
          {best.transfers} transfer{best.transfers === 1 ? "" : "s"}
        </Badge>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="ml-auto">
          Edit team
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        <Delta value={netGain} points className="font-mono text-3xl" />
        <p className="text-xs text-muted-foreground">vs keeping your current team</p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {renderRows(driverRows)}
        {renderRows(constructorRows)}
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
        {extra > 0 ? (
          <span className="text-neg">
            {free} free + {extra} extra · −{penaltyPts} pts penalty
          </span>
        ) : (
          <span className="text-muted-foreground">Within your free transfers — no penalty.</span>
        )}
      </p>

      <p className="text-xs text-muted-foreground">
        Budget after:{" "}
        <span className={cn("font-mono tabular-nums", budgetNegative && "text-neg")}>
          {formatPriceTenths(best.budgetLeftTenths)}
        </span>
        {whatIf === "limitless" && " (Limitless ignores budget)"}
      </p>

      <Progress value={spentPct} aria-label="Squad value as a share of your purse" />

      <div className="rounded-md bg-surface-2 p-3">
        <p className="text-sm font-medium">
          DRS Boost → {captainName}{" "}
          {/* warn, not red: small text on the raised surface — red fails AA
              there, and §10 reserves red for the primary action + deltas. */}
          <span className="text-warn">(×{DRS_BOOST_MULTIPLIER})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSignedPoints(captainBoost)} pts boosted
        </p>
        <p className="text-xs text-muted-foreground">Highest projected driver in this squad.</p>
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

      <Collapsible
        open={rankOpen}
        onOpenChange={setRankOpen}
        className="rounded-lg border border-grid-line bg-surface-2/40"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-f1">
          {/* Heading semantics live INSIDE the trigger so tests find the
              ranking either by role=heading or by the button's name. */}
          <h3 className="text-sm font-semibold">DRS Boost ranking</h3>
          <span aria-hidden="true" className="text-muted-foreground">
            ⌄
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          <ul className="flex flex-col gap-1">
            {ranked.map((d) => {
              const isCaptain = d.id === best.captainId
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
    </Card>
  )
}
