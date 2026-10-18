"use client"

import type { TeamStateV2 } from "@/lib/team/types/team-state"

import { useState } from "react"

import { formatCostCapTenths } from "@/lib/team/cost-cap"
import { useTeamStore } from "@/lib/team/store"

import { useCostCapInput, type UseCostCapInputReturn } from "@/hooks/use-cost-cap-input"

export type FreeTransfers = TeamStateV2["freeTransfers"]

/**
 * The team picker's local draft (lineup selection, Remaining Cost Cap, free transfers), held
 * until Save. Edit mode seeds it from the store, but the store hydrates after
 * the first render (localStorage is read lazily on subscribe), so the seed runs
 * during render, guarded to fire once when hydration lands. That is React's
 * documented pattern for adjusting state to an external value, and it avoids
 * the extra render an effect would cause. First-run seeds nothing: an empty
 * team and "unlimited" free transfers, as for a first race.
 */
export function useTeamDraft(mode: "first-run" | "edit"): {
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  costCap: UseCostCapInputReturn
  freeTransfers: FreeTransfers
  setFreeTransfers: React.Dispatch<React.SetStateAction<FreeTransfers>>
} {
  const { state, hydrated } = useTeamStore()

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const costCap = useCostCapInput("")
  const [freeTransfers, setFreeTransfers] = useState<FreeTransfers>("unlimited")

  const [seeded, setSeeded] = useState(mode === "first-run")
  if (!seeded && mode === "edit" && hydrated) {
    if (state.lineup) setSelected(new Set(state.lineup))
    costCap.setValue(formatCostCapTenths(state.remainingCostCapTenths))
    setFreeTransfers(state.freeTransfers)
    setSeeded(true)
  }

  return { selected, setSelected, costCap, freeTransfers, setFreeTransfers }
}
