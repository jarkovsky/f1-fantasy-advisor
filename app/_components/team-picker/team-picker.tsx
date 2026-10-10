"use client"

import { useId, useMemo, useState } from "react"

import { BankInput } from "@/app/_components/shared/bank-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTeamDraft } from "@/hooks/use-team-draft"
import type { AssetLite } from "@/lib/asset-lite"
import { SQUAD_CONSTRUCTORS, SQUAD_DRIVERS } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { useTeamStore } from "@/lib/team/store"

import { FreeTransfersField } from "./free-transfers-field"
import { PickerTable } from "./picker-table"
import { StartOverDialog } from "./start-over-dialog"

/**
 * The team-setup flow as ONE Card (M5 redesign): two stacked kind tables on
 * the left — Drivers and Constructors, filtered by one shared search box —
 * and a narrow control column on the right (selection summary,
 * remaining-budget input, free-transfers control, status pill, the single Save
 * CTA). Selection is local DRAFT state until Save (useTeamDraft) — nothing
 * touches the store until the user commits.
 *
 * This container owns selection + validation logic; <PickerTable> is dumb and
 * just renders the draft. Validation is spec §5.1: the ONLY blockers are an
 * incomplete squad shape (need exactly 5+2) and a not-yet-entered bank.
 * Over-spend vs the $100M initial cap is NOT a blocker — mid-season prices
 * drift the binding constraint to team value + bank (spec §4.1).
 */

type TeamPickerProps = {
  assets: AssetLite[]
  raceNumber: number
  mode: "first-run" | "edit"
  onDone?: () => void
}

export function TeamPicker({ assets, raceNumber, mode, onDone }: TeamPickerProps) {
  const { setTeam, reset } = useTeamStore()
  const { selected, setSelected, bank, freeTransfers, setFreeTransfers } = useTeamDraft(mode)

  const byId = useMemo(() => new Map(assets.map((a) => [a.playerId, a])), [assets])

  // One search box filters BOTH kind tables below.
  const [query, setQuery] = useState("")

  // The two kind tables (user feedback: separate tables, not one filtered list).
  const drivers = useMemo(() => assets.filter((a) => a.kind === "driver"), [assets])
  const constructors = useMemo(() => assets.filter((a) => a.kind === "constructor"), [assets])

  // --- Derived counts / spend ---------------------------------------------
  const { driverCount, constructorCount, teamValueTenths } = useMemo(() => {
    let driversN = 0
    let constructorsN = 0
    let value = 0
    for (const id of selected) {
      const asset = byId.get(id)
      if (!asset) continue
      value += asset.priceTenths
      if (asset.kind === "driver") driversN += 1
      else constructorsN += 1
    }
    return { driverCount: driversN, constructorCount: constructorsN, teamValueTenths: value }
  }, [selected, byId])

  const driversFull = driverCount >= SQUAD_DRIVERS
  const constructorsFull = constructorCount >= SQUAD_CONSTRUCTORS

  // --- Validation (spec §5.1) ---------------------------------------------
  const squadComplete = driverCount === SQUAD_DRIVERS && constructorCount === SQUAD_CONSTRUCTORS
  const blocked = !squadComplete || !bank.entered

  // --- Live-region copy ----------------------------------------------------
  const liveMessage = useMemo(() => {
    if (!squadComplete) {
      return `${SQUAD_DRIVERS} drivers and ${SQUAD_CONSTRUCTORS} constructors required — you have ${driverCount} drivers and ${constructorCount} constructors.`
    }
    if (!bank.entered) {
      return "Squad complete — enter your remaining budget."
    }
    return "Team valid — recommendations ready."
  }, [squadComplete, bank.entered, driverCount, constructorCount])

  // --- Selection ----------------------------------------------------------
  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      const asset = byId.get(id)
      if (!asset) return next
      // Guard at the data layer too: never exceed a kind quota.
      if (asset.kind === "driver" && driversFull) return next
      if (asset.kind === "constructor" && constructorsFull) return next
      next.add(id)
      return next
    })
  }

  // --- Save / cancel / reset ----------------------------------------------
  function handleSave(): void {
    if (blocked) return
    // Deterministic roster: drivers then constructors, each ascending by id.
    const driverIds: string[] = []
    const constructorIds: string[] = []
    for (const id of selected) {
      const asset = byId.get(id)
      if (!asset) continue
      if (asset.kind === "driver") driverIds.push(id)
      else constructorIds.push(id)
    }
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
    driverIds.sort(cmp)
    constructorIds.sort(cmp)
    setTeam([...driverIds, ...constructorIds], bank.tenths, freeTransfers, raceNumber)
    onDone?.()
  }

  function handleStartOver(): void {
    reset()
    onDone?.()
  }

  const liveId = useId()
  const bankId = useId()
  const searchId = useId()

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* Live region: present from first render so changes are announced. */}
        <div id={liveId} role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          {/* LEFT: one shared search box over the two kind tables. */}
          <div className="flex flex-col gap-4">
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drivers & constructors…"
              aria-label="Search drivers and constructors"
              className="sm:max-w-xs"
            />
            <PickerTable
              heading="Drivers"
              assets={drivers}
              selected={selected}
              quotaFull={driversFull}
              query={query}
              onToggle={toggle}
            />
            <PickerTable
              heading="Constructors"
              assets={constructors}
              selected={selected}
              quotaFull={constructorsFull}
              query={query}
              onToggle={toggle}
            />
          </div>

          {/* RIGHT: summary, budget, transfers, status, CTA. */}
          <div className="flex flex-col gap-5 lg:border-l lg:border-grid-line lg:pl-6">
            <p className="font-mono text-sm tabular-nums">
              Drivers {driverCount}/{SQUAD_DRIVERS} · Constructors {constructorCount}/
              {SQUAD_CONSTRUCTORS} · Spent {formatPriceTenths(teamValueTenths)}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={bankId} className="text-sm font-medium">
                Remaining budget
              </label>
              <BankInput
                id={bankId}
                value={bank.value}
                onChange={bank.setValue}
                onBlur={bank.normalize}
              />
              <p className="text-xs text-muted-foreground">
                Your bank from F1 Fantasy — after any transfers you already made.
              </p>
            </div>

            <FreeTransfersField value={freeTransfers} onChange={setFreeTransfers} />

            <div className="flex items-center gap-2">
              {blocked ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                  {squadComplete ? "Enter budget" : "Squad incomplete"}
                </span>
              ) : (
                <span className="rounded-full bg-accent-f1-quiet px-2 py-0.5 text-xs text-accent-f1">
                  Ready
                </span>
              )}
            </div>

            {/* Exactly ONE save button. Cancel + Start over only in edit mode. */}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="primary-f1"
                disabled={blocked}
                aria-disabled={blocked || undefined}
                onClick={handleSave}
              >
                {mode === "edit" ? "Save changes" : "Save team & get advice"}
              </Button>

              {mode === "edit" && (
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                  </Button>
                  <StartOverDialog onConfirm={handleStartOver} />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
