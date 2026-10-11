"use client"

import { Suspense, useMemo, useState } from "react"

import { BetweenRounds } from "@/app/_components/advisor/between-rounds"
import { LockedView } from "@/app/_components/advisor/locked-view"
import { OpenAdvisor } from "@/app/_components/advisor/open-advisor"
import { RolloverForm } from "@/app/_components/rollover/rollover-form"
import { SeasonEnded } from "@/app/_components/advisor/season-ended"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { usePresetParam } from "@/hooks/use-preset-param"
import { useProjection } from "@/hooks/use-projection"
import { useRaceWeekState } from "@/hooks/use-race-week-state"
import type { AdvisorServerProps, WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"
import { useTeamStore } from "@/lib/team/store"

const POLL_MS = 30_000

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
 * The advisor island: derives the §5.4 race-week state on the client and
 * dispatches to the matching screen. Preset (URL-driven) and blend/what-if live
 * here because the resolved projection is consumed by both LOCKED and OPEN.
 * useSearchParams (inside usePresetParam) MUST stay under the Suspense boundary
 * above — this component is that boundary.
 */
function AdvisorPanelInner(props: AdvisorServerProps) {
  const { state: team, hydrated, applyPlan, confirmRollover } = useTeamStore()

  const now = useNow(POLL_MS)
  const { preset, onPresetChange } = usePresetParam()

  const [blendWeight, setBlendWeight] = useState(0.5)
  const [whatIf, setWhatIf] = useState<WhatIfMode>("none")

  const { projection, totals } = useProjection(props.projectionsByPreset, preset, blendWeight)

  const assetsById = useMemo<Record<string, AssetLite>>(() => {
    const out: Record<string, AssetLite> = {}
    for (const a of props.assets) out[a.playerId] = a
    return out
  }, [props.assets])

  const raceState = useRaceWeekState({
    now,
    hydrated,
    constraints: props.constraints,
    raceWeekends: props.raceWeekends,
    nextRacePublished: props.nextRacePublished,
    live: props.live,
    storedRaceNumber: team.raceNumber,
  })

  if (raceState === null) return <PanelShell />

  const currentWeekend = props.raceWeekends.find(
    (w) => w.raceNumber === props.constraints.raceNumber
  )
  const roster = team.roster

  switch (raceState.kind) {
    case "FIRST_VISIT": {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {raceState.lockAtMs !== null
              ? `Building your team for the ${currentWeekend?.gpName ?? "next race"} · locks ${new Intl.DateTimeFormat(
                  undefined,
                  { weekday: "short", hour: "2-digit", minute: "2-digit" }
                ).format(raceState.lockAtMs)}`
              : "Next race — schedule pending."}
          </p>
          <TeamPicker
            assets={props.assets}
            raceNumber={props.constraints.raceNumber}
            mode="first-run"
          />
        </div>
      )
    }

    case "ROLLOVER": {
      return (
        <RolloverForm
          from={raceState.from}
          to={raceState.to}
          assets={props.assets}
          assetsById={assetsById}
          team={team}
          onConfirm={confirmRollover}
        />
      )
    }

    case "LOCKED": {
      const later = props.raceWeekends.find((w) => w.raceNumber > raceState.race)
      return (
        <LockedView
          gpName={raceState.gpName}
          live={raceState.live}
          roster={roster ?? []}
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
          pointsRace={
            props.constraints.lastCompletedRace >= 1 ? props.constraints.lastCompletedRace : null
          }
          roster={roster ?? []}
          assetsById={assetsById}
          lastRacePoints={props.lastRacePoints}
          savedProjection={team.savedProjection}
        />
      )
    }

    case "SEASON_ENDED": {
      return <SeasonEnded roster={roster ?? []} assetsById={assetsById} />
    }

    case "OPEN": {
      return (
        <OpenAdvisor
          props={props}
          raceState={raceState}
          currentWeekend={currentWeekend}
          assetsById={assetsById}
          projection={projection}
          totals={totals}
          preset={preset}
          onPresetChange={onPresetChange}
          blendWeight={blendWeight}
          setBlendWeight={setBlendWeight}
          whatIf={whatIf}
          setWhatIf={setWhatIf}
          team={team}
          applyPlan={applyPlan}
        />
      )
    }
  }
}
