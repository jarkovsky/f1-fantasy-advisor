"use client"

import type { AdvisorServerProps, WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"

import { Suspense, useMemo, useState } from "react"

import { useTeamStore } from "@/lib/team/store"

import { Skeleton } from "@/components/ui/skeleton"

import { useRaceWeekState } from "@/hooks/use-race-week-state"
import { usePresetParam } from "@/hooks/use-preset-param"
import { useProjection } from "@/hooks/use-projection"
import { useNow } from "@/hooks/use-now"

import { BetweenRounds } from "@/app/_components/advisor/between-rounds"
import { RolloverForm } from "@/app/_components/rollover/rollover-form"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { OpenAdvisor } from "@/app/_components/advisor/open-advisor"
import { SeasonEnded } from "@/app/_components/advisor/season-ended"
import { LockedView } from "@/app/_components/advisor/locked-view"

const POLL_MS = 30_000

const firstVisitLockFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function firstVisitIntro(gpName: string | undefined, lockAtMs: number | null): string {
  if (lockAtMs === null) return "Next race — schedule pending."
  return `Building your team for the ${gpName ?? "next race"} · locks ${firstVisitLockFmt.format(lockAtMs)}`
}

/** Neutral block layout mirrored by the Suspense fallback + pre-derive shell. */
function PanelShell() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function AdvisorPanel(props: AdvisorServerProps) {
  return (
    <Suspense fallback={<PanelShell />}>
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
  nextRacePublished,
  live,
  assets,
  projectionsByPreset,
  lastRacePoints,
  meta,
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
    nextRacePublished,
    live,
    storedRaceNumber: team.raceNumber,
  })

  if (raceState === null) return <PanelShell />

  const currentWeekend = raceWeekends.find((w) => w.raceNumber === constraints.raceNumber)
  const roster = team.roster ?? []

  switch (raceState.kind) {
    case "FIRST_VISIT": {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {firstVisitIntro(currentWeekend?.gpName, raceState.lockAtMs)}
          </p>
          <TeamPicker assets={assets} raceNumber={constraints.raceNumber} mode="first-run" />
        </div>
      )
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
          roster={roster}
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
          roster={roster}
          assetsById={assetsById}
          lastRacePoints={lastRacePoints}
          savedProjection={team.savedProjection}
        />
      )
    }

    case "SEASON_ENDED": {
      return <SeasonEnded roster={roster} assetsById={assetsById} />
    }

    case "OPEN": {
      return (
        <OpenAdvisor
          raceState={raceState}
          currentWeekend={currentWeekend}
          assets={assets}
          assetsById={assetsById}
          raceNumber={constraints.raceNumber}
          meta={meta}
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
