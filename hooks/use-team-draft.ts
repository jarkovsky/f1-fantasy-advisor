"use client"

import { useState } from "react"

import { formatBankTenths } from "@/lib/team/bank"
import { useTeamStore } from "@/lib/team/store"

import { useBankInput, type UseBankInputReturn } from "@/hooks/use-bank-input"

export type FreeTransfers = 2 | 3 | "unlimited"

/**
 * The team-picker's local DRAFT state (roster selection, bank, free transfers),
 * held until Save. In edit mode it seeds from the store — but the store hydrates
 * AFTER the first render (localStorage is read lazily on subscribe), so the seed
 * runs during render, guarded to fire exactly once when hydration first lands.
 * That is React's documented escape hatch for adjusting state to an external
 * value and avoids the cascading re-render an effect would cause. First-run
 * seeds nothing: empty squad, "unlimited" default (the first-race framing).
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
