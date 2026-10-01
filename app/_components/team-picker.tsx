"use client"

import { useId, useMemo, useState } from "react"

import { PickerTable } from "@/app/_components/picker-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { AssetLite } from "@/lib/asset-lite"
import { SQUAD_CONSTRUCTORS, SQUAD_DRIVERS } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { useTeamStore } from "@/lib/store"

/**
 * The team-setup flow as ONE Card (M5 redesign): two stacked kind tables on
 * the left — Drivers and Constructors, filtered by one shared search box —
 * and a narrow control column on the right (selection summary,
 * remaining-budget input, free-transfers control, status pill, the single Save
 * CTA). Selection is local DRAFT state until Save — nothing touches the store
 * until the user commits (first-run Save, edit Save, or Start over).
 *
 * This container owns ALL selection + validation logic; <PickerTable> is dumb
 * and just renders the draft. Validation is spec §5.1: the ONLY blockers are an
 * incomplete squad shape (need exactly 5+2) and a not-yet-entered bank.
 * Over-spend vs the $100M initial cap is NOT a blocker — mid-season prices
 * drift the binding constraint to team value + bank (spec §4.1).
 */

const FREE_TRANSFER_OPTIONS = [
  { value: 2 as const, label: "2" },
  { value: 3 as const, label: "3" },
  { value: "unlimited" as const, label: "Unlimited" },
]

type FreeTransfers = 2 | 3 | "unlimited"

type TeamPickerProps = {
  assets: AssetLite[]
  raceNumber: number
  mode: "first-run" | "edit"
  onDone?: () => void
}

export function TeamPicker({
  assets,
  raceNumber,
  mode,
  onDone,
}: TeamPickerProps) {
  const { state, hydrated, setTeam, reset } = useTeamStore()

  const byId = useMemo(
    () => new Map(assets.map((a) => [a.playerId, a])),
    [assets]
  )

  // --- Draft state (local until Save) -------------------------------------
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  // budget as a raw string so the field can be empty ("" = not yet entered).
  const [bankInput, setBankInput] = useState<string>("")
  const [freeTransfers, setFreeTransfers] = useState<FreeTransfers>("unlimited")
  // One search box filters BOTH kind tables below.
  const [query, setQuery] = useState("")

  // The two kind tables (user feedback: separate tables, not one filtered list).
  const drivers = useMemo(
    () => assets.filter((a) => a.kind === "driver"),
    [assets]
  )
  const constructors = useMemo(
    () => assets.filter((a) => a.kind === "constructor"),
    [assets]
  )

  // Edit mode seeds the draft from the store, but the store hydrates AFTER the
  // first render (localStorage is read lazily on subscribe). Seeding during
  // render — guarded so it runs exactly once, when hydration first lands — is
  // React's documented escape hatch for adjusting state to an external value,
  // and avoids the cascading re-render an effect would cause. First-run seeds
  // nothing: empty squad, "unlimited" default (the first-race framing).
  const [seeded, setSeeded] = useState(mode === "first-run")
  if (!seeded && mode === "edit" && hydrated) {
    if (state.roster) setSelected(new Set(state.roster))
    setBankInput((state.budgetTenths / 10).toFixed(1))
    setFreeTransfers(state.freeTransfers)
    setSeeded(true)
  }

  // --- Derived counts / spend ---------------------------------------------
  const { driverCount, constructorCount, teamValueTenths } = useMemo(() => {
    let drivers = 0
    let constructors = 0
    let value = 0
    for (const id of selected) {
      const asset = byId.get(id)
      if (!asset) continue
      value += asset.priceTenths
      if (asset.kind === "driver") drivers += 1
      else constructors += 1
    }
    return {
      driverCount: drivers,
      constructorCount: constructors,
      teamValueTenths: value,
    }
  }, [selected, byId])

  const driversFull = driverCount >= SQUAD_DRIVERS
  const constructorsFull = constructorCount >= SQUAD_CONSTRUCTORS

  // --- Bank parsing --------------------------------------------------------
  const bankTrimmed = bankInput.trim()
  const bankNumber = bankTrimmed === "" ? null : Number(bankTrimmed)
  const bankEntered =
    bankNumber !== null && Number.isFinite(bankNumber) && bankNumber >= 0
  const bankTenths = bankEntered ? Math.round(bankNumber * 10) : 0

  // --- Validation (spec §5.1) ---------------------------------------------
  const squadComplete =
    driverCount === SQUAD_DRIVERS && constructorCount === SQUAD_CONSTRUCTORS
  const blocked = !squadComplete || !bankEntered

  // --- Live-region copy ----------------------------------------------------
  const liveMessage = useMemo(() => {
    if (!squadComplete) {
      return `${SQUAD_DRIVERS} drivers and ${SQUAD_CONSTRUCTORS} constructors required — you have ${driverCount} drivers and ${constructorCount} constructors.`
    }
    if (!bankEntered) {
      return "Squad complete — enter your remaining budget."
    }
    return "Team valid — recommendations ready."
  }, [squadComplete, bankEntered, driverCount, constructorCount])

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
    setTeam(
      [...driverIds, ...constructorIds],
      bankTenths,
      freeTransfers,
      raceNumber
    )
    onDone?.()
  }

  function handleStartOver(): void {
    reset()
    onDone?.()
  }

  const liveId = useId()
  const bankId = useId()

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
              Drivers {driverCount}/{SQUAD_DRIVERS} · Constructors{" "}
              {constructorCount}/{SQUAD_CONSTRUCTORS} · Spent{" "}
              {formatPriceTenths(teamValueTenths)}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={bankId} className="text-sm font-medium">
                Remaining budget
              </label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="font-mono text-muted-foreground"
                >
                  $
                </span>
                <input
                  id={bankId}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={bankInput}
                  onChange={(e) => setBankInput(e.target.value)}
                  onBlur={(e) => {
                    const v = Number(e.target.value)
                    if (e.target.value.trim() !== "" && Number.isFinite(v)) {
                      setBankInput((Math.round(v * 10) / 10).toFixed(1))
                    }
                  }}
                  className="h-9 w-32 rounded-md border border-input bg-surface-1 px-2.5 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent-f1"
                />
                <span className="font-mono text-sm text-muted-foreground">
                  M
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your bank from F1 Fantasy — after any transfers you already
                made.
              </p>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">Free transfers</legend>
              <div
                role="radiogroup"
                aria-label="Free transfers"
                className="flex gap-1.5"
              >
                {FREE_TRANSFER_OPTIONS.map((opt) => {
                  const active = freeTransfers === opt.value
                  return (
                    <Button
                      key={String(opt.value)}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      variant={active ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setFreeTransfers(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                3 only if you banked an unused transfer last week; none carry
                over after Wildcard or Limitless. Unlimited = your first race or
                an active Wildcard.
              </p>
            </fieldset>

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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-muted-foreground"
                      >
                        Start over
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Start over?</DialogTitle>
                        <DialogDescription>
                          This clears your saved team, budget, and transfer
                          count.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="ghost">
                            Keep my team
                          </Button>
                        </DialogClose>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleStartOver}
                        >
                          Start over
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
