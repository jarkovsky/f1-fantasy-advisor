"use client"

import type { FeedProvenance, WhatIfMode } from "@/lib/advisor/types/contract"
import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { OptimizerResult } from "@/lib/optimizer/types/optimizer"
import type { DriverProfile } from "@/lib/profile/types/profile"
import type { PresetId } from "@/lib/projections/types/presets"
import type { TeamStateV2 } from "@/lib/team/types/team-state"
import type { RaceWeekState } from "@/lib/f1/raceweek"
import type { RaceWeekend } from "@/lib/f1/schemas"
import type { AssetLite } from "@/lib/asset-lite"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Skeleton } from "@/components/ui/skeleton"

import { useOptimizer } from "@/hooks/use-optimizer"

import { ProjectionControls } from "@/app/_components/advisor/projection-controls"
import { TeamComparison } from "@/app/_components/team-plan/team-comparison"
import { SnapshotBanner } from "@/app/_components/advisor/snapshot-banner"
import { BoostRanking } from "@/app/_components/team-plan/boost-ranking"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { Alternatives } from "@/app/_components/advisor/alternatives"
import { HonestyNote } from "@/app/_components/advisor/honesty-note"
import { RaceHeader } from "@/app/_components/advisor/race-header"

type OpenState = Extract<RaceWeekState, { kind: "OPEN" }>

type OpenAdvisorProps = {
  raceState: OpenState
  currentWeekend: RaceWeekend | undefined
  assets: AssetLite[]
  assetsById: Record<string, AssetLite>
  driverProfiles: Record<string, DriverProfile>
  raceNumber: number
  meta: FeedProvenance
  projection: ProjectionResult
  totals: Record<string, number>
  preset: PresetId
  onPresetChange: (id: PresetId) => void
  blendWeight: number
  onBlendWeightChange: (w: number) => void
  whatIf: WhatIfMode
  onWhatIfChange: (mode: WhatIfMode) => void
  team: TeamStateV2
  applyPlan: (
    lineup: string[],
    remainingCostCapTenths: number,
    savedProjection?: TeamStateV2["savedProjection"]
  ) => void
}

/**
 * The OPEN-state screen: the race widget, then your team beside the
 * recommended team (TeamComparison), the projection model that drives it,
 * the Boost ranking, the other transfer counts, and the honesty note. Owns the editor toggle,
 * the optimizer (via useOptimizer, which keeps the search a lazy chunk), the
 * apply flow, and the sr-only status region.
 */
export function OpenAdvisor({
  raceState,
  currentWeekend,
  assets,
  assetsById,
  driverProfiles,
  raceNumber,
  meta,
  projection,
  totals,
  preset,
  onPresetChange,
  blendWeight,
  onBlendWeightChange,
  whatIf,
  onWhatIfChange,
  team,
  applyPlan,
}: OpenAdvisorProps) {
  const [showEditor, setShowEditor] = useState(false)
  const { lineup, remainingCostCapTenths, freeTransfers } = team

  const { result, baseline, unresolvedIds, error, isPending, statusMessage } = useOptimizer({
    assets,
    totals,
    lineup,
    remainingCostCapTenths,
    freeTransfers,
    whatIf,
  })

  // "applied" is derived from whether the current result is the one applied, so
  // any later recompute (a new result reference) re-arms the button with no
  // effect and no cascading render.
  const [appliedResult, setAppliedResult] = useState<OptimizerResult | null>(null)
  const applied = appliedResult !== null && appliedResult === result

  function handleApply(): void {
    if (!result) return
    const plan = result.best
    applyPlan([...plan.driverIds, ...plan.constructorIds], plan.remainingCostCapTenths, {
      totalPoints: plan.projectedTotal,
      preset: projection.effectivePreset,
    })
    setAppliedResult(result)
  }

  if (showEditor) {
    return (
      <TeamPicker
        assets={assets}
        raceNumber={raceNumber}
        mode="edit"
        onDone={() => setShowEditor(false)}
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
      <SnapshotBanner meta={meta} />

      {currentWeekend && (
        <RaceHeader
          raceNumber={raceState.race}
          gpName={raceState.gpName}
          circuitLocation={currentWeekend.circuitLocation}
          isSprint={raceState.isSprint}
          sessions={currentWeekend.sessions}
          lockAtMs={raceState.lockAtMs}
        />
      )}

      <div className={cn(isPending && "opacity-60")}>
        {error ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-warn">
            {error}
          </p>
        ) : result ? (
          <TeamComparison
            result={result}
            baseline={baseline}
            assetsById={assetsById}
            driverProfiles={driverProfiles}
            totals={totals}
            remainingCostCapTenths={remainingCostCapTenths}
            freeTransfers={whatIf !== "none" ? "unlimited" : freeTransfers}
            whatIf={whatIf}
            unresolvedIds={unresolvedIds}
            applied={applied}
            onApply={handleApply}
            onEdit={() => setShowEditor(true)}
          />
        ) : (
          <Skeleton className="h-[40rem] w-full rounded-xl" />
        )}
      </div>

      <ProjectionControls
        preset={preset}
        onPresetChange={onPresetChange}
        blendWeight={blendWeight}
        onBlendWeightChange={onBlendWeightChange}
        whatIf={whatIf}
        onWhatIfChange={onWhatIfChange}
        projection={projection}
      />

      {result && <BoostRanking plan={result.best} assetsById={assetsById} totals={totals} />}

      {result && (
        <Alternatives
          result={result}
          baseline={baseline}
          assetsById={assetsById}
          projection={projection}
        />
      )}

      <HonestyNote />
    </div>
  )
}
