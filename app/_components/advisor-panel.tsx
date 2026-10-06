"use client"

import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Suspense,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import type { AdvisorServerProps, WhatIfMode } from "@/app/_components/advisor-types"
import { Alternatives } from "@/app/_components/alternatives"
import { BetweenRounds } from "@/app/_components/between-rounds"
import { HonestyNote } from "@/app/_components/honesty-note"
import { LockedView } from "@/app/_components/locked-view"
import { ProjectionControls } from "@/app/_components/projection-controls"
import { RaceHeader } from "@/app/_components/race-header"
import { RolloverForm } from "@/app/_components/rollover-form"
import { SeasonEnded } from "@/app/_components/season-ended"
import { SnapshotBanner } from "@/app/_components/snapshot-banner"
import { TeamPicker } from "@/app/_components/team-picker"
import { TeamPlanCard } from "@/app/_components/team-plan-card"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { AssetLite } from "@/lib/asset-lite"
import { currentTimeMs } from "@/lib/dev-now"
import { deriveRaceWeekState } from "@/lib/f1/raceweek"
import type {
  OptimizerInputError as OptimizerInputErrorType,
  OptimizerResult,
  TeamPlan,
} from "@/lib/optimizer"
import { reconcileRoster, toOptimizerAssets } from "@/lib/optimizer-adapter"
import { resolveClientProjection } from "@/lib/projection-resolve"
import { PRESET_IDS, type PresetId } from "@/lib/projections"
import { useTeamStore } from "@/lib/store"
import { cn } from "@/lib/utils"

// Type-only import of the optimizer module for the dynamic import contract; the
// actual value is loaded lazily (no static value import — keeps it out of the
// island's first-load bundle, plan D4).
type OptimizerModule = typeof import("@/lib/optimizer")

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

function AdvisorPanelInner(props: AdvisorServerProps) {
  const { state: team, hydrated, applyPlan, confirmRollover } = useTeamStore()
  const router = useRouter()
  // useSearchParams MUST live in this inner component (the only CSR-bailout
  // boundary) so the PPR shell can prerender without it.
  const searchParams = useSearchParams()

  // --- Clock (post-mount only — never read the wall clock during render) ----
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(currentTimeMs())
    const id = setInterval(() => setNow(currentTimeMs()), POLL_MS)
    return () => clearInterval(id)
  }, [])

  // --- Preset (URL-driven) --------------------------------------------------
  const presetParam = searchParams.get("preset")
  const preset: PresetId = (PRESET_IDS as readonly string[]).includes(presetParam ?? "")
    ? (presetParam as PresetId)
    : "weighted-recent"

  function onPresetChange(id: PresetId): void {
    startTransition(() => {
      router.replace(`/?preset=${id}` as Route, { scroll: false })
    })
  }

  // --- Local UI state -------------------------------------------------------
  const [blendWeight, setBlendWeight] = useState(0.5)
  const [whatIf, setWhatIf] = useState<WhatIfMode>("none")
  const [showEditor, setShowEditor] = useState(false)
  const [applied, setApplied] = useState(false)

  // --- Projection -----------------------------------------------------------
  // Memoized so the custom-blend path (which builds a fresh byPlayerId map each
  // call) stays referentially stable across incidental re-renders — otherwise
  // `totals` below re-materializes and the optimizer effect re-runs the full
  // ~1.45M-combination search on every render, including the 30s clock tick.
  const deferredBlend = useDeferredValue(blendWeight)
  const projection = useMemo(
    () => resolveClientProjection(props.projectionsByPreset, preset, deferredBlend),
    [props.projectionsByPreset, preset, deferredBlend]
  )

  const totals = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const [id, p] of Object.entries(projection.byPlayerId)) {
      out[id] = p.totalPoints
    }
    return out
  }, [projection])

  const assetsById = useMemo<Record<string, AssetLite>>(() => {
    const out: Record<string, AssetLite> = {}
    for (const a of props.assets) out[a.playerId] = a
    return out
  }, [props.assets])

  // --- Race-week state ------------------------------------------------------
  const raceState = useMemo(() => {
    if (now === null || !hydrated) return null
    return deriveRaceWeekState({
      now: new Date(now),
      constraints: props.constraints,
      raceWeekends: props.raceWeekends,
      nextRacePublished: props.nextRacePublished,
      storedRaceNumber: team.raceNumber,
      live: props.live,
    })
  }, [
    now,
    hydrated,
    props.constraints,
    props.raceWeekends,
    props.nextRacePublished,
    props.live,
    team.raceNumber,
  ])

  // --- Optimizer (lazy, plan D4 bundle isolation) ---------------------------
  const optimizerRef = useRef<OptimizerModule | null>(null)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [baseline, setBaseline] = useState<TeamPlan | null>(null)
  const [unresolvedIds, setUnresolvedIds] = useState<string[]>([])
  const [optError, setOptError] = useState<string | null>(null)
  const [isPending, startOptTransition] = useTransition()
  const [statusMsg, setStatusMsg] = useState("")

  const roster = team.roster
  const budgetTenths = team.budgetTenths
  const storeFreeTransfers = team.freeTransfers
  const isOpen = raceState?.kind === "OPEN"

  // Kick off the dynamic import on the first OPEN render.
  useEffect(() => {
    if (!isOpen || optimizerRef.current) return
    let cancelled = false
    void import("@/lib/optimizer").then((mod) => {
      if (!cancelled) optimizerRef.current = mod
    })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !roster) return
    let cancelled = false
    setStatusMsg("Recomputing recommendation…")

    void (async () => {
      const mod = optimizerRef.current ?? (await import("@/lib/optimizer"))
      optimizerRef.current = mod
      if (cancelled) return

      const grid = toOptimizerAssets(props.assets, totals)
      const { assets: grid2, unresolvedIds: missing } = reconcileRoster(roster, grid)
      const input = {
        assets: grid2,
        roster,
        budgetTenths,
        freeTransfers: whatIf !== "none" ? ("unlimited" as const) : storeFreeTransfers,
        mode: whatIf === "none" ? ("normal" as const) : whatIf,
      }

      try {
        const optimized = mod.optimize(input)
        // Baseline = keeping the current team: a 0-transfer plan if one exists.
        const keep = optimized.byTransferCount[0] ?? null
        if (cancelled) return
        startOptTransition(() => {
          setResult(optimized)
          setBaseline(keep)
          setUnresolvedIds(missing)
          setOptError(null)
          setStatusMsg(
            `Updated — ${optimized.best.transfers} transfers, ${optimized.best.score.toFixed(1)} points.`
          )
        })
      } catch (err) {
        if (cancelled) return
        const isInputErr =
          err instanceof (mod.OptimizerInputError as typeof OptimizerInputErrorType)
        startOptTransition(() => {
          setResult(null)
          setOptError(
            isInputErr && err instanceof Error ? err.message : "Could not compute a recommendation."
          )
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, totals, roster, budgetTenths, storeFreeTransfers, whatIf, props.assets])

  // Applying a plan resets the local "applied" flag false→true; any later
  // recompute (new totals/roster) clears it so the button re-arms.
  useEffect(() => {
    setApplied(false)
  }, [result])

  function handleApply(): void {
    if (!result) return
    const plan = result.best
    applyPlan([...plan.driverIds, ...plan.constructorIds], plan.budgetLeftTenths, {
      totalPoints: plan.projectedTotal,
      preset: projection.effectivePreset,
    })
    setApplied(true)
  }

  // --- Render ---------------------------------------------------------------
  const liveRegion = (
    <div role="status" aria-live="polite" className="sr-only">
      {statusMsg}
    </div>
  )

  if (raceState === null) return <PanelShell />

  const currentWeekend = props.raceWeekends.find(
    (w) => w.raceNumber === props.constraints.raceNumber
  )

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
        // Single centered column (M5): Grand Prix card → merged team/plan card →
        // alternatives → controls → honesty note. No more two-pane command
        // center; the merged card absorbs your-team + recommended-plan + captain.
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {liveRegion}
          <SnapshotBanner meta={props.meta} />

          {currentWeekend && (
            // The Grand Prix card — the race header framed as the first card.
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
            {optError ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-warn">
                {optError}
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
  }
}
