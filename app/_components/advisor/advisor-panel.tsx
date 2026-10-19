"use client"

import type { AdvisorServerProps, WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"

import { Suspense, useMemo, useState } from "react"

import { useTeamStore } from "@/lib/team/store"

import { useRaceWeekState } from "@/hooks/use-race-week-state"
import { usePresetParam } from "@/hooks/use-preset-param"
import { useProjection } from "@/hooks/use-projection"
import { useNow } from "@/hooks/use-now"

import { AdvisorSkeleton } from "@/app/_components/advisor/advisor-skeleton"
import { BetweenRounds } from "@/app/_components/advisor/between-rounds"
import { RolloverForm } from "@/app/_components/rollover/rollover-form"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { OpenAdvisor } from "@/app/_components/advisor/open-advisor"
import { SeasonEnded } from "@/app/_components/advisor/season-ended"
import { LockedView } from "@/app/_components/advisor/locked-view"

const POLL_MS = 30_000

export function AdvisorPanel(props: AdvisorServerProps) {
  return (
    <Suspense fallback={<AdvisorSkeleton />}>
      <AdvisorPanelInner {...props} />
    </Suspense>
  )
}

/**
 * The advisor island: derives the race-week state on the client and dispatches
 * to the matching screen. Preset (URL-driven) and blend weight live here
 * because the resolved projection feeds both LOCKED and OPEN. usePresetParam
 * reads useSearchParams, so this component must render inside the Suspense
 * boundary in AdvisorPanel.
 */
function AdvisorPanelInner({
  constraints,
  raceWeekends,
  live,
  assets,
  projectionsByPreset,
  driverProfiles,
  lastRacePoints,
}: AdvisorServerProps) {
  const { state: team, hydrated, applyPlan, confirmRollover } = useTeamStore()

  const now = useNow(POLL_MS)
  const { preset, onPresetChange } = usePresetParam()

  const [blendWeight, setBlendWeight] = useState(0.5)
  const [whatIf, setWhatIf] = useState<WhatIfMode>("none")

  const { projection, totals } = useProjection(projectionsByPreset, preset, blendWeight)

  const assetsById = useMemo<Record<string, AssetLite>>(() => {
    const out: Record<string, AssetLite> = {}
    for (const a of assets) out[a.playerId] = a
    return out
  }, [assets])

  const raceState = useRaceWeekState({
    now,
    hydrated,
    constraints,
    raceWeekends,
    live,
    storedRaceNumber: team.raceNumber,
  })

  if (raceState === null) return <AdvisorSkeleton />

  const currentWeekend = raceWeekends.find((w) => w.raceNumber === constraints.raceNumber)
  const lineup = team.lineup ?? []

  switch (raceState.kind) {
    case "FIRST_VISIT": {
      return <TeamPicker assets={assets} raceNumber={constraints.raceNumber} mode="first-run" />
    }

    case "ROLLOVER": {
      return (
        <RolloverForm
          from={raceState.from}
          to={raceState.to}
          assets={assets}
          assetsById={assetsById}
          team={team}
          onConfirm={confirmRollover}
        />
      )
    }

    case "LOCKED": {
      const later = raceWeekends.find((w) => w.raceNumber > raceState.race)
      return (
        <LockedView
          gpName={raceState.gpName}
          live={raceState.live}
          lineup={lineup}
          assetsById={assetsById}
          projection={projection}
          nextLockAtMs={later?.lockAtMs ?? null}
        />
      )
    }

    case "BETWEEN_ROUNDS": {
      return (
        <BetweenRounds
          lastCompleted={raceState.lastCompleted}
          pointsRace={constraints.lastCompletedRace >= 1 ? constraints.lastCompletedRace : null}
          lineup={lineup}
          assetsById={assetsById}
          lastRacePoints={lastRacePoints}
          savedProjection={team.savedProjection}
        />
      )
    }

    case "SEASON_ENDED": {
      return <SeasonEnded lineup={lineup} assetsById={assetsById} />
    }

    case "OPEN": {
      return (
        <OpenAdvisor
          raceState={raceState}
          currentWeekend={currentWeekend}
          assets={assets}
          assetsById={assetsById}
          driverProfiles={driverProfiles}
          raceNumber={constraints.raceNumber}
          projection={projection}
          totals={totals}
          preset={preset}
          onPresetChange={onPresetChange}
          blendWeight={blendWeight}
          onBlendWeightChange={setBlendWeight}
          whatIf={whatIf}
          onWhatIfChange={setWhatIf}
          team={team}
          applyPlan={applyPlan}
        />
      )
    }
  }
}
