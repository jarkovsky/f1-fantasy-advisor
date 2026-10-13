"use client"

import type { TeamStateV1 } from "@/lib/team/types/team-state"

import { useState } from "react"

import { formatBankTenths } from "@/lib/team/bank"
import { useTeamStore } from "@/lib/team/store"

import { useBankInput, type UseBankInputReturn } from "@/hooks/use-bank-input"

export type FreeTransfers = TeamStateV1["freeTransfers"]

/**
 * The team picker's local draft (roster selection, bank, free transfers), held
 * until Save. Edit mode seeds it from the store, but the store hydrates after
 * the first render (localStorage is read lazily on subscribe), so the seed runs
 * during render, guarded to fire once when hydration lands. That is React's
 * documented pattern for adjusting state to an external value, and it avoids
 * the extra render an effect would cause. First-run seeds nothing: an empty
 * squad and "unlimited" free transfers, as for a first race.
 */
export function useTeamDraft(mode: "first-run" | "edit"): {
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  bank: UseBankInputReturn
  freeTransfers: FreeTransfers
  setFreeTransfers: React.Dispatch<React.SetStateAction<FreeTransfers>>
} {
  const { state, hydrated } = useTeamStore()

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const bank = useBankInput("")
  const [freeTransfers, setFreeTransfers] = useState<FreeTransfers>("unlimited")

  const [seeded, setSeeded] = useState(mode === "first-run")
  if (!seeded && mode === "edit" && hydrated) {
    if (state.roster) setSelected(new Set(state.roster))
    bank.setValue(formatBankTenths(state.budgetTenths))
    setFreeTransfers(state.freeTransfers)
    setSeeded(true)
  }

  return { selected, setSelected, bank, freeTransfers, setFreeTransfers }
}
