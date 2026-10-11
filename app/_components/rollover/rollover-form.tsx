"use client"

import type { TeamStateV1 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { Button } from "@/components/ui/button"

import { type RolloverConfirm, useRolloverForm } from "@/hooks/use-rollover-form"

import { TransfersStep } from "./transfers-step"
import { BudgetStep } from "./budget-step"
import { SquadStep } from "./squad-step"

/**
 * ROLLOVER (spec §5.4): the server pointer advanced past the saved team's race,
 * so the user must reconcile before the new week opens. A stepped form — confirm
 * the squad (at new prices), confirm the bank, choose the transfer allowance /
 * chip — then commit via confirmRollover (which bumps the stored raceNumber and
 * flips the machine to OPEN). All state lives in useRolloverForm; this shell is
 * the banner + the three step cards + the confirm control.
 */
type RolloverFormProps = {
  from: number
  to: number
  assets: AssetLite[]
  assetsById: Record<string, AssetLite>
  team: TeamStateV1
  onConfirm: RolloverConfirm
}

export function RolloverForm({ from, to, assets, assetsById, team, onConfirm }: RolloverFormProps) {
  const f = useRolloverForm({ team, to, assetsById, onConfirm })

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-surface-2 p-4">
        <p className="font-medium">New race week — confirm your team.</p>
        <p className="text-sm text-muted-foreground">
          Race {from} is done; race {to} is open. Reconcile your squad to continue.
        </p>
      </div>

      <SquadStep
        resolved={f.resolved}
        unresolvedIds={f.unresolvedIds}
        squadChoice={f.squadChoice}
        onKeep={f.keepSquad}
        onEdit={f.editSquad}
        editing={f.editing}
        assets={assets}
        to={to}
        closeEditor={f.closeEditor}
      />

      {f.squadChoice !== null && (
        <BudgetStep bank={f.bank} bankInputRef={f.bankInputRef} legendRef={f.step2Ref} />
      )}

      {f.step3Revealed && (
        <TransfersStep
          transferChoice={f.transferChoice}
          setTransferChoice={f.setTransferChoice}
          chipChoice={f.chipChoice}
          setChipChoice={f.setChipChoice}
          legendRef={f.step3Ref}
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {f.summary}
      </p>

      <Button
        type="button"
        variant="primary-f1"
        disabled={!f.canConfirm}
        aria-disabled={!f.canConfirm || undefined}
        onClick={f.handleConfirm}
        className="self-start"
      >
        Confirm and continue
      </Button>
    </div>
  )
}
