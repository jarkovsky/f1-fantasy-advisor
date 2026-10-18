"use client"

import type { TeamStateV2 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { useEffect, useRef, useState } from "react"

import { TEAM_CONSTRUCTORS, TEAM_DRIVERS } from "@/lib/constants"
import { formatCostCapTenths } from "@/lib/team/cost-cap"
import { formatPriceTenths } from "@/lib/format"

import { useCostCapInput } from "@/hooks/use-cost-cap-input"

export type TeamChoice = "kept" | "edit"
export type TransferChoice = "standard" | "carriedOver" | "chip"
export type ChipChoice = "wildcard" | "limitless"

type FreeTransfers = TeamStateV2["freeTransfers"]
type ActiveChip = TeamStateV2["activeChip"]

export type RolloverConfirm = (args: {
  lineup: string[]
  remainingCostCapTenths: number
  freeTransfers: FreeTransfers
  raceNumber: number
  activeChip: ActiveChip
}) => void

/**
 * The rollover form's state and derivation: the stepped team, Remaining Cost Cap, and
 * transfer choices, focus management as each step reveals, and the confirm
 * summary and handler.
 */
export function useRolloverForm(args: {
  team: TeamStateV2
  to: number
  assetsById: Record<string, AssetLite>
  onConfirm: RolloverConfirm
}) {
  const { team, to, assetsById, onConfirm } = args
  const savedLineup = team.lineup ?? []

  const [teamChoice, setTeamChoice] = useState<TeamChoice | null>(null)
  const [editing, setEditing] = useState(false)
  const costCap = useCostCapInput(formatCostCapTenths(team.remainingCostCapTenths))
  const [transferChoice, setTransferChoice] = useState<TransferChoice | null>(null)
  const [chipChoice, setChipChoice] = useState<ChipChoice | null>(null)

  // Move focus to each newly revealed step's legend.
  const step2Ref = useRef<HTMLLegendElement>(null)
  const step3Ref = useRef<HTMLLegendElement>(null)
  const costCapInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (teamChoice !== null) step2Ref.current?.focus()
  }, [teamChoice])

  const resolved = savedLineup
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)
  const unresolvedIds = savedLineup.filter((id) => assetsById[id] === undefined)

  // Reveal focus for step 3, but never steal it from the step-2 legend (just
  // placed by the effect above) or from the Remaining Cost Cap input while the user is
  // retyping a cleared value.
  const step3Revealed = teamChoice !== null && costCap.entered
  useEffect(() => {
    if (!step3Revealed) return
    const active = document.activeElement
    if (active === step2Ref.current || active === costCapInputRef.current) return
    step3Ref.current?.focus()
  }, [step3Revealed])

  const freeTransfers: FreeTransfers =
    transferChoice === "chip" ? "unlimited" : transferChoice === "carriedOver" ? 3 : 2
  const activeChip: ActiveChip = transferChoice === "chip" ? (chipChoice ?? "none") : "none"

  const transfersResolved =
    transferChoice === "chip" ? chipChoice !== null : transferChoice !== null

  const canConfirm =
    teamChoice !== null &&
    savedLineup.length === TEAM_DRIVERS + TEAM_CONSTRUCTORS &&
    costCap.entered &&
    transfersResolved

  const teamLabel = teamChoice === "kept" ? "your kept team" : "your edited team"
  const allowance = allowanceLabel(freeTransfers, activeChip)
  const summary = canConfirm
    ? `Confirming ${teamLabel} with ${formatPriceTenths(costCap.tenths)} Remaining Cost Cap and ${allowance}.`
    : "Complete every step to continue."

  function keepTeam(): void {
    setTeamChoice("kept")
    setEditing(false)
  }

  function editTeam(): void {
    setTeamChoice("edit")
    setEditing(true)
  }

  // Saving in the editor ends the rollover (this form unmounts), so closing
  // here only ever means Cancel: nothing was edited, so withdraw the choice.
  function closeEditor(): void {
    setEditing(false)
    setTeamChoice(null)
  }

  function handleConfirm(): void {
    if (!canConfirm) return
    onConfirm({
      lineup: savedLineup,
      remainingCostCapTenths: costCap.tenths,
      freeTransfers,
      raceNumber: to,
      activeChip,
    })
  }

  return {
    teamChoice,
    keepTeam,
    editTeam,
    editing,
    closeEditor,
    costCap,
    costCapInputRef,
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
