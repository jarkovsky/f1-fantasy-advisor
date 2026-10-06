"use client"

import { useEffect, useRef, useState } from "react"

import { Delta } from "@/app/_components/delta"
import { UnavailableAssetTile } from "@/app/_components/unavailable-asset-tile"
import { TeamPicker } from "@/app/_components/team-picker"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AssetLite } from "@/lib/asset-lite"
import { assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import type { TeamStateV1 } from "@/lib/store"
import { teamColor } from "@/lib/team-colors"

/**
 * ROLLOVER (spec §5.4): the server pointer advanced past the saved team's race,
 * so the user must reconcile before the new week opens. A stepped form: confirm
 * the squad (at new prices), confirm the bank, choose the transfer allowance /
 * chip — then commit via confirmRollover (which bumps the stored raceNumber and
 * flips the machine to OPEN).
 */
type RolloverFormProps = {
  from: number
  to: number
  assets: AssetLite[]
  assetsById: Record<string, AssetLite>
  team: TeamStateV1
  onConfirm: (args: {
    roster: string[]
    budgetTenths: number
    freeTransfers: 2 | 3 | "unlimited"
    raceNumber: number
    activeChip: "none" | "wildcard" | "limitless"
  }) => void
}

type SquadChoice = "kept" | "edit"
type TransferChoice = "standard" | "banked" | "chip"
type ChipChoice = "wildcard" | "limitless"

export function RolloverForm({ from, to, assets, assetsById, team, onConfirm }: RolloverFormProps) {
  const savedRoster = team.roster ?? []

  const [squadChoice, setSquadChoice] = useState<SquadChoice | null>(null)
  const [draftRoster, setDraftRoster] = useState<string[]>(savedRoster)
  const [editing, setEditing] = useState(false)
  const [bankInput, setBankInput] = useState<string>((team.budgetTenths / 10).toFixed(1))
  const [transferChoice, setTransferChoice] = useState<TransferChoice | null>(null)
  const [chipChoice, setChipChoice] = useState<ChipChoice | null>(null)

  // Move focus to each newly revealed step's legend.
  const step2Ref = useRef<HTMLLegendElement>(null)
  const step3Ref = useRef<HTMLLegendElement>(null)
  const bankInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (squadChoice !== null) step2Ref.current?.focus()
  }, [squadChoice])

  const resolved = draftRoster
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)
  const unresolvedIds = draftRoster.filter((id) => assetsById[id] === undefined)

  const bankTrimmed = bankInput.trim()
  const bankNumber = bankTrimmed === "" ? null : Number(bankTrimmed)
  const bankEntered = bankNumber !== null && Number.isFinite(bankNumber) && bankNumber >= 0
  const bankTenths = bankEntered ? Math.round(bankNumber * 10) : 0

  // Reveal focus for step 3, but never steal it from the step-2 legend (just
  // placed by the effect above) or from the bank input while the user is
  // retyping a cleared value.
  const step3Revealed = squadChoice !== null && bankEntered
  useEffect(() => {
    if (!step3Revealed) return
    const active = document.activeElement
    if (active === step2Ref.current || active === bankInputRef.current) return
    step3Ref.current?.focus()
  }, [step3Revealed])

  const freeTransfers: 2 | 3 | "unlimited" =
    transferChoice === "chip" ? "unlimited" : transferChoice === "banked" ? 3 : 2
  const activeChip: "none" | "wildcard" | "limitless" =
    transferChoice === "chip" ? (chipChoice ?? "none") : "none"

  const transfersResolved =
    transferChoice === "chip" ? chipChoice !== null : transferChoice !== null

  const canConfirm =
    squadChoice !== null && draftRoster.length === 7 && bankEntered && transfersResolved

  const summary = canConfirm
    ? `Confirming ${
        squadChoice === "kept" ? "your kept squad" : "your edited squad"
      } with ${formatPriceTenths(bankTenths)} bank and ${
        freeTransfers === "unlimited"
          ? activeChip === "limitless"
            ? "Limitless"
            : "Wildcard"
          : `${freeTransfers} free transfers`
      }.`
    : "Complete every step to continue."

  function handleConfirm(): void {
    if (!canConfirm) return
    onConfirm({
      roster: draftRoster,
      budgetTenths: bankTenths,
      freeTransfers,
      raceNumber: to,
      activeChip,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-surface-2 p-4">
        <p className="font-medium">New race week — confirm your team.</p>
        <p className="text-sm text-muted-foreground">
          Race {from} is done; race {to} is open. Reconcile your squad to continue.
        </p>
      </div>

      {/* Step 1: squad */}
      <Card className="gap-3 bg-surface-1 p-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">Did your squad change?</legend>

          <ul className="flex flex-col gap-0.5">
            {resolved.map((a) => {
              const priceDelta = a.priceTenths - a.prevPriceTenths
              return (
                <li key={a.playerId} className="flex items-center gap-2 py-1 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-4 w-[3px] shrink-0 rounded-full"
                    style={{ background: teamColor(assetColorKey(a)) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.displayName}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatPriceTenths(a.priceTenths)}
                  </span>
                  <Delta value={priceDelta} tenths className="font-mono text-xs" />
                </li>
              )
            })}
          </ul>

          {unresolvedIds.length > 0 && (
            <div className="flex flex-col gap-2">
              {unresolvedIds.map((id) => (
                <UnavailableAssetTile
                  key={id}
                  id={id}
                  onReplace={() => {
                    setSquadChoice("edit")
                    setEditing(true)
                  }}
                />
              ))}
            </div>
          )}

          <div
            role="radiogroup"
            aria-label="Did your squad change?"
            className="flex flex-col gap-1.5"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="squad-choice"
                checked={squadChoice === "kept"}
                onChange={() => {
                  setSquadChoice("kept")
                  setEditing(false)
                  setDraftRoster(savedRoster)
                }}
              />
              I kept this exact team
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="squad-choice"
                checked={squadChoice === "edit"}
                onChange={() => {
                  setSquadChoice("edit")
                  setEditing(true)
                }}
              />
              I made transfers — let me edit
            </label>
          </div>
        </fieldset>
      </Card>

      {/* The picker renders its own Card (M5), so it sits BETWEEN the step
          cards rather than nested inside step 1. */}
      {editing && (
        <TeamPicker assets={assets} raceNumber={to} mode="edit" onDone={() => setEditing(false)} />
      )}

      {/* Step 2: budget */}
      {squadChoice !== null && (
        <Card className="gap-3 bg-surface-1 p-4">
          <fieldset className="flex flex-col gap-2">
            <legend ref={step2Ref} tabIndex={-1} className="text-sm font-semibold outline-none">
              What&apos;s your remaining budget now?
            </legend>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="font-mono text-muted-foreground">
                $
              </span>
              <input
                ref={bankInputRef}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={bankInput}
                aria-label="Remaining budget"
                onChange={(e) => setBankInput(e.target.value)}
                className="h-9 w-32 rounded-md border border-input bg-surface-1 px-2.5 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent-f1"
              />
              <span className="font-mono text-sm text-muted-foreground">M</span>
            </div>
            <p className="text-xs text-muted-foreground">From F1 Fantasy, after price changes.</p>
          </fieldset>
        </Card>
      )}

      {/* Step 3: transfers */}
      {squadChoice !== null && bankEntered && (
        <Card className="gap-3 bg-surface-1 p-4">
          <fieldset className="flex flex-col gap-2">
            <legend ref={step3Ref} tabIndex={-1} className="text-sm font-semibold outline-none">
              Transfers this week?
            </legend>
            <div
              role="radiogroup"
              aria-label="Transfers this week?"
              className="flex flex-col gap-1.5"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="transfer-choice"
                  checked={transferChoice === "standard"}
                  onChange={() => setTransferChoice("standard")}
                />
                Standard (2 free)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="transfer-choice"
                  checked={transferChoice === "banked"}
                  onChange={() => setTransferChoice("banked")}
                />
                I banked a transfer (3 free)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="transfer-choice"
                  checked={transferChoice === "chip"}
                  onChange={() => setTransferChoice("chip")}
                />
                I played a chip
              </label>
            </div>

            {transferChoice === "chip" && (
              <div
                role="radiogroup"
                aria-label="Which chip?"
                className="flex flex-col gap-1.5 pl-6"
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="chip-choice"
                    checked={chipChoice === "wildcard"}
                    onChange={() => setChipChoice("wildcard")}
                  />
                  Wildcard — unlimited this week
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="chip-choice"
                    checked={chipChoice === "limitless"}
                    onChange={() => setChipChoice("limitless")}
                  />
                  Limitless — unlimited + budget ignored; your pre-chip roster comes back next week
                </label>
              </div>
            )}
          </fieldset>
        </Card>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>

      <Button
        type="button"
        variant="primary-f1"
        disabled={!canConfirm}
        aria-disabled={!canConfirm || undefined}
        onClick={handleConfirm}
        className="self-start"
      >
        Confirm and continue
      </Button>
    </div>
  )
}
