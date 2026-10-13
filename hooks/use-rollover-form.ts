"use client"

import type { TeamStateV1 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { useEffect, useRef, useState } from "react"

import { SQUAD_CONSTRUCTORS, SQUAD_DRIVERS } from "@/lib/constants"
import { formatBankTenths } from "@/lib/team/bank"
import { formatPriceTenths } from "@/lib/format"

import { useBankInput } from "@/hooks/use-bank-input"

export type SquadChoice = "kept" | "edit"
export type TransferChoice = "standard" | "banked" | "chip"
export type ChipChoice = "wildcard" | "limitless"

type FreeTransfers = TeamStateV1["freeTransfers"]
type ActiveChip = TeamStateV1["activeChip"]

export type RolloverConfirm = (args: {
  roster: string[]
  budgetTenths: number
  freeTransfers: FreeTransfers
  raceNumber: number
  activeChip: ActiveChip
}) => void

/**
 * The rollover form's state and derivation: the stepped squad, bank, and
 * transfer choices, focus management as each step reveals, and the confirm
 * summary and handler.
 */
export function useRolloverForm(args: {
  team: TeamStateV1
  to: number
  assetsById: Record<string, AssetLite>
  onConfirm: RolloverConfirm
}) {
  const { team, to, assetsById, onConfirm } = args
  const savedRoster = team.roster ?? []

  const [squadChoice, setSquadChoice] = useState<SquadChoice | null>(null)
  const [editing, setEditing] = useState(false)
  const bank = useBankInput(formatBankTenths(team.budgetTenths))
  const [transferChoice, setTransferChoice] = useState<TransferChoice | null>(null)
  const [chipChoice, setChipChoice] = useState<ChipChoice | null>(null)

  // Move focus to each newly revealed step's legend.
  const step2Ref = useRef<HTMLLegendElement>(null)
  const step3Ref = useRef<HTMLLegendElement>(null)
  const bankInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (squadChoice !== null) step2Ref.current?.focus()
  }, [squadChoice])

  const resolved = savedRoster
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)
  const unresolvedIds = savedRoster.filter((id) => assetsById[id] === undefined)

  // Reveal focus for step 3, but never steal it from the step-2 legend (just
  // placed by the effect above) or from the bank input while the user is
  // retyping a cleared value.
  const step3Revealed = squadChoice !== null && bank.entered
  useEffect(() => {
    if (!step3Revealed) return
    const active = document.activeElement
    if (active === step2Ref.current || active === bankInputRef.current) return
    step3Ref.current?.focus()
  }, [step3Revealed])

  const freeTransfers: FreeTransfers =
    transferChoice === "chip" ? "unlimited" : transferChoice === "banked" ? 3 : 2
  const activeChip: ActiveChip = transferChoice === "chip" ? (chipChoice ?? "none") : "none"

  const transfersResolved =
    transferChoice === "chip" ? chipChoice !== null : transferChoice !== null

  const canConfirm =
    squadChoice !== null &&
    savedRoster.length === SQUAD_DRIVERS + SQUAD_CONSTRUCTORS &&
    bank.entered &&
    transfersResolved

  const squadLabel = squadChoice === "kept" ? "your kept squad" : "your edited squad"
  const allowance = allowanceLabel(freeTransfers, activeChip)
  const summary = canConfirm
    ? `Confirming ${squadLabel} with ${formatPriceTenths(bank.tenths)} bank and ${allowance}.`
    : "Complete every step to continue."

  function keepSquad(): void {
    setSquadChoice("kept")
    setEditing(false)
  }

  function editSquad(): void {
    setSquadChoice("edit")
    setEditing(true)
  }

  function closeEditor(): void {
    setEditing(false)
  }

  function handleConfirm(): void {
    if (!canConfirm) return
    onConfirm({
      roster: savedRoster,
      budgetTenths: bank.tenths,
      freeTransfers,
      raceNumber: to,
      activeChip,
    })
  }

  return {
    squadChoice,
    keepSquad,
    editSquad,
    editing,
    closeEditor,
    bank,
    bankInputRef,
    transferChoice,
    setTransferChoice,
    chipChoice,
    setChipChoice,
    resolved,
    unresolvedIds,
    step3Revealed,
    canConfirm,
    summary,
    step2Ref,
    step3Ref,
    handleConfirm,
  }
}

function allowanceLabel(freeTransfers: FreeTransfers, activeChip: ActiveChip): string {
  if (freeTransfers !== "unlimited") return `${freeTransfers} free transfers`
  return activeChip === "limitless" ? "Limitless" : "Wildcard"
}
