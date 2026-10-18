"use client"

import type { TeamStateV2 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { Button } from "@/components/ui/button"

import { type RolloverConfirm, useRolloverForm } from "@/hooks/use-rollover-form"

import { TransfersStep } from "./transfers-step"
import { CostCapStep } from "./cost-cap-step"
import { TeamStep } from "./team-step"

/**
 * The ROLLOVER race-week state: the server's current race has moved past the
 * saved team's race, so the user reconciles before the new week opens. A
 * stepped form (confirm the team at new prices, confirm the Remaining Cost Cap, choose the
 * transfer allowance or chip) that commits via confirmRollover, which bumps the
 * stored raceNumber and moves the race-week state to OPEN. All state lives in
 * useRolloverForm; this component lays out the banner, steps, and confirm.
 */
type RolloverFormProps = {
  from: number
  to: number
  assets: AssetLite[]
  assetsById: Record<string, AssetLite>
  team: TeamStateV2
  onConfirm: RolloverConfirm
}

export function RolloverForm({ from, to, assets, assetsById, team, onConfirm }: RolloverFormProps) {
  const form = useRolloverForm({ team, to, assetsById, onConfirm })

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-surface-2 p-4">
        <p className="font-medium">New race week — confirm your team.</p>
        <p className="text-sm text-muted-foreground">
          Race {from} is done; race {to} is open. Reconcile your team to continue.
        </p>
      </div>

      <TeamStep
        resolved={form.resolved}
        unresolvedIds={form.unresolvedIds}
        teamChoice={form.teamChoice}
        onKeep={form.keepTeam}
        onEdit={form.editTeam}
        editing={form.editing}
        assets={assets}
        raceNumber={to}
        onEditorDone={form.closeEditor}
      />

      {form.teamChoice !== null && (
        <CostCapStep
          costCap={form.costCap}
          costCapInputRef={form.costCapInputRef}
          legendRef={form.step2Ref}
        />
      )}

      {form.step3Revealed && (
        <TransfersStep
          transferChoice={form.transferChoice}
          setTransferChoice={form.setTransferChoice}
          chipChoice={form.chipChoice}
          setChipChoice={form.setChipChoice}
          legendRef={form.step3Ref}
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {form.summary}
      </p>

      <Button
        type="button"
        variant="primary-f1"
        disabled={!form.canConfirm}
        onClick={form.handleConfirm}
        className="self-start"
      >
        Confirm and continue
      </Button>
    </div>
  )
}
