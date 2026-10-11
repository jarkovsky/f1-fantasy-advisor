"use client"

import type { AdvisorServerProps, WhatIfMode } from "@/lib/advisor/types/contract"
import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { OptimizerResult } from "@/lib/optimizer/types/optimizer"
import type { PresetId } from "@/lib/projections/types/presets"
import type { TeamStateV1 } from "@/lib/team/types/team-state"
import type { RaceWeekState } from "@/lib/f1/raceweek"
import type { RaceWeekend } from "@/lib/f1/schemas"
import type { AssetLite } from "@/lib/asset-lite"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

import { useOptimizer } from "@/hooks/use-optimizer"

import { ProjectionControls } from "@/app/_components/advisor/projection-controls"
import { SnapshotBanner } from "@/app/_components/advisor/snapshot-banner"
import { TeamPlanCard } from "@/app/_components/team-plan/team-plan-card"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { Alternatives } from "@/app/_components/advisor/alternatives"
import { HonestyNote } from "@/app/_components/advisor/honesty-note"
import { RaceHeader } from "@/app/_components/advisor/race-header"

type OpenState = Extract<RaceWeekState, { kind: "OPEN" }>

/**
 * The OPEN-state screen (spec §10 M5): single centered column — Grand Prix card
 * → merged team/plan card → alternatives → controls → honesty note. Owns the
 * editor toggle, the optimizer (via useOptimizer, which keeps the search a lazy
 * chunk), the apply flow, and the sr-only status region.
 */
export function OpenAdvisor({
  props,
  raceState,
  currentWeekend,
  assetsById,
  projection,
  totals,
  preset,
  onPresetChange,
  blendWeight,
  setBlendWeight,
  whatIf,
  setWhatIf,
  team,
  applyPlan,
}: {
  props: AdvisorServerProps
  raceState: OpenState
  currentWeekend: RaceWeekend | undefined
  assetsById: Record<string, AssetLite>
  projection: ProjectionResult
  totals: Record<string, number>
  preset: PresetId
  onPresetChange: (id: PresetId) => void
  blendWeight: number
  setBlendWeight: (w: number) => void
  whatIf: WhatIfMode
  setWhatIf: (m: WhatIfMode) => void
  team: TeamStateV1
  applyPlan: (
    roster: string[],
    budgetTenths: number,
    savedProjection?: TeamStateV1["savedProjection"]
  ) => void
}) {
  const [showEditor, setShowEditor] = useState(false)
  const roster = team.roster
  const budgetTenths = team.budgetTenths
  const storeFreeTransfers = team.freeTransfers

  const { result, baseline, unresolvedIds, error, isPending, statusMessage } = useOptimizer({
    enabled: true,
    assets: props.assets,
    totals,
    roster,
    budgetTenths,
    freeTransfers: storeFreeTransfers,
    whatIf,
  })

  // "applied" is derived from whether the CURRENT result is the one applied, so
  // any later recompute (a new result reference) re-arms the button with no
  // effect and no cascading render.
  const [appliedResult, setAppliedResult] = useState<OptimizerResult | null>(null)
  const applied = appliedResult !== null && appliedResult === result

  function handleApply(): void {
    if (!result) return
    const plan = result.best
    applyPlan([...plan.driverIds, ...plan.constructorIds], plan.budgetLeftTenths, {
      totalPoints: plan.projectedTotal,
      preset: projection.effectivePreset,
    })
    setAppliedResult(result)
  }

  if (showEditor) {
    return (
      <TeamPicker
        assets={props.assets}
        raceNumber={props.constraints.raceNumber}
        mode="edit"
        onDone={() => setShowEditor(false)}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
      <SnapshotBanner meta={props.meta} />

      {currentWeekend && (
        <Card className="bg-surface-1 p-5">
          <RaceHeader
            gpName={raceState.gpName}
            circuitLocation={currentWeekend.circuitLocation}
            isSprint={raceState.isSprint}
            sessions={currentWeekend.sessions}
            lockAtMs={raceState.lockAtMs}
          />
        </Card>
      )}

      <div className={cn(isPending && "opacity-60")}>
        {error ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-warn">
            {error}
          </p>
        ) : result ? (
          <TeamPlanCard
            roster={roster ?? []}
            result={result}
            baseline={baseline}
            assetsById={assetsById}
            totals={totals}
            budgetTenths={budgetTenths}
            freeTransfers={whatIf !== "none" ? "unlimited" : storeFreeTransfers}
            whatIf={whatIf}
            unresolvedIds={unresolvedIds}
            applied={applied}
            onApply={handleApply}
            onKeep={() => setShowEditor(true)}
            onEdit={() => setShowEditor(true)}
          />
        ) : (
          <Skeleton className="h-96 w-full" />
        )}
      </div>

      {result && (
        <Alternatives
          result={result}
          baseline={baseline}
          assetsById={assetsById}
          projection={projection}
        />
      )}

      <ProjectionControls
        preset={preset}
        onPresetChange={onPresetChange}
        blendWeight={blendWeight}
        onBlendWeightChange={setBlendWeight}
        whatIf={whatIf}
        onWhatIfChange={setWhatIf}
        projection={projection}
      />
      <HonestyNote />
    </div>
  )
}
