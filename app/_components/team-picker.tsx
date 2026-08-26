"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

import { AssetCard } from "@/app/_components/asset-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AssetLite } from "@/lib/asset-lite"
import { SQUAD_CONSTRUCTORS, SQUAD_DRIVERS } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { useTeamStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * The team-setup flow: a two-tab (drivers / constructors) roving-tabindex
 * listbox grid, a sticky summary + validation bar, and a budget/transfers step,
 * writing directly to useTeamStore. Selection is local DRAFT state until Save —
 * nothing touches the store until the user commits (first-run Save, edit Save,
 * or Start over).
 *
 * Validation is spec §5.1: the ONLY blockers are an incomplete/over squad shape
 * (need exactly 5+2) and a not-yet-entered bank. Over-spend vs the $100M initial
 * cap is NOT a blocker — mid-season prices drift the binding constraint to
 * team value + bank (spec §4.1). A value+bank outside $90–130M only raises a
 * non-blocking sanity warning.
 */

const FREE_TRANSFER_OPTIONS = [
  { value: 2 as const, label: "2" },
  { value: 3 as const, label: "3" },
  { value: "unlimited" as const, label: "Unlimited" },
]

/** Sanity-warn band (inclusive) for team value + bank, in tenths. */
const SANITY_MIN_TENTHS = 900
const SANITY_MAX_TENTHS = 1300

type FreeTransfers = 2 | 3 | "unlimited"

type TeamPickerProps = {
  assets: AssetLite[]
  budgetCapTenths: number
  raceNumber: number
  mode: "first-run" | "edit"
  onDone?: () => void
}

/**
 * Column count for ArrowUp/ArrowDown navigation. Derived from the same
 * breakpoints as the grid; jsdom has no layout so matchMedia returns the base
 * (1 column) and vertical arrows degrade to ±1 — acceptable per spec.
 */
function useColumnCount(): number {
  const [cols, setCols] = useState(1)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const queries: [string, number][] = [
      ["(min-width: 1280px)", 4],
      ["(min-width: 1024px)", 3],
      ["(min-width: 640px)", 2],
    ]
    const mqls = queries.map(([q]) => window.matchMedia(q))
    const compute = () => {
      const hit = queries.find(([q]) => window.matchMedia(q).matches)
      setCols(hit ? hit[1] : 1)
    }
    compute()
    for (const mql of mqls) mql.addEventListener("change", compute)
    return () => {
      for (const mql of mqls) mql.removeEventListener("change", compute)
    }
  }, [])
  return cols
}

export function TeamPicker({
  assets,
  budgetCapTenths,
  raceNumber,
  mode,
  onDone,
}: TeamPickerProps) {
  const { state, hydrated, setTeam, reset } = useTeamStore()

  const drivers = useMemo(
    () =>
      assets
        .filter((a) => a.kind === "driver")
        .sort((a, b) => b.priceTenths - a.priceTenths),
    [assets]
  )
  const constructors = useMemo(
    () =>
      assets
        .filter((a) => a.kind === "constructor")
        .sort((a, b) => b.priceTenths - a.priceTenths),
    [assets]
  )
  const byId = useMemo(
    () => new Map(assets.map((a) => [a.playerId, a])),
    [assets]
  )

  // --- Draft state (local until Save) -------------------------------------
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  // budget as a raw string so the field can be empty ("" = not yet entered).
  const [bankInput, setBankInput] = useState<string>("")
  const [freeTransfers, setFreeTransfers] = useState<FreeTransfers>("unlimited")

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
  const selectedDrivers = useMemo(
    () => drivers.filter((a) => selected.has(a.playerId)),
    [drivers, selected]
  )
  const selectedConstructors = useMemo(
    () => constructors.filter((a) => selected.has(a.playerId)),
    [constructors, selected]
  )
  const driverCount = selectedDrivers.length
  const constructorCount = selectedConstructors.length

  const teamValueTenths = useMemo(() => {
    let sum = 0
    for (const id of selected) sum += byId.get(id)?.priceTenths ?? 0
    return sum
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

  const valuePlusBank = teamValueTenths + bankTenths
  const sanityWarn =
    squadComplete &&
    bankEntered &&
    (valuePlusBank < SANITY_MIN_TENTHS || valuePlusBank > SANITY_MAX_TENTHS)

  const sanityText = sanityWarn
    ? `Heads up — team value plus budget is ${formatPriceTenths(valuePlusBank)}, outside the usual $90–130M range. Double-check your bank against F1 Fantasy.`
    : ""

  // Progress denominator: spent vs (spent + bank) once bank entered, else cap.
  const progressMax = bankEntered
    ? teamValueTenths + bankTenths
    : budgetCapTenths
  const progressValue =
    progressMax > 0 ? Math.min(100, (teamValueTenths / progressMax) * 100) : 0

  // --- Live-region copy ----------------------------------------------------
  const liveMessage = useMemo(() => {
    let base: string
    if (!squadComplete) {
      base = `${SQUAD_DRIVERS} drivers and ${SQUAD_CONSTRUCTORS} constructors required — you have ${driverCount} drivers and ${constructorCount} constructors.`
    } else if (!bankEntered) {
      base = "Squad complete — enter your remaining budget."
    } else {
      base = "Team valid — recommendations ready."
    }
    return sanityText ? `${base} ${sanityText}` : base
  }, [squadComplete, bankEntered, driverCount, constructorCount, sanityText])

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
    const driverIds = selectedDrivers
      .map((a) => a.playerId)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const constructorIds = selectedConstructors
      .map((a) => a.playerId)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
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

  // First-run reveals the budget step only once the squad is complete.
  const showBudgetStep = mode === "edit" || squadComplete

  const liveId = useId()

  return (
    <div className="flex flex-col gap-4">
      {/* Live region: present from first render so changes are announced. */}
      <div id={liveId} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {/* Sticky summary + validation + CTA */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg bg-surface-0/95 p-3 ring-1 ring-grid-line backdrop-blur supports-backdrop-filter:bg-surface-0/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm tabular-nums">
            Drivers {driverCount}/{SQUAD_DRIVERS} · Constructors{" "}
            {constructorCount}/{SQUAD_CONSTRUCTORS} · Spent{" "}
            {formatPriceTenths(teamValueTenths)}
          </p>
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
            <Button
              type="button"
              variant="primary-f1"
              disabled={blocked}
              aria-disabled={blocked || undefined}
              onClick={handleSave}
            >
              {mode === "edit" ? "Save changes" : "Save team & get advice"}
            </Button>
          </div>
        </div>
        <Progress
          value={progressValue}
          aria-label="Squad value as a share of your purse"
        />
        {sanityWarn && <p className="text-xs text-warn">{sanityText}</p>}
      </div>

      {/* The two-tab listbox grids */}
      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">Drivers ({drivers.length})</TabsTrigger>
          <TabsTrigger value="constructors">
            Constructors ({constructors.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="drivers">
          <ListboxGrid
            label="Drivers"
            assets={drivers}
            selected={selected}
            quotaFull={driversFull}
            onToggle={toggle}
          />
        </TabsContent>
        <TabsContent value="constructors">
          <ListboxGrid
            label="Constructors"
            assets={constructors}
            selected={selected}
            quotaFull={constructorsFull}
            onToggle={toggle}
          />
        </TabsContent>
      </Tabs>

      {/* Budget + transfers step */}
      {showBudgetStep && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${liveId}-bank`} className="text-sm font-medium">
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
                  id={`${liveId}-bank`}
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

            {/* Edit-mode footer actions live with the step */}
            {mode === "edit" && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary-f1"
                    disabled={blocked}
                    aria-disabled={blocked || undefined}
                    onClick={handleSave}
                  >
                    Save changes
                  </Button>
                  <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                  </Button>
                </div>
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
                        This clears your saved team, budget, and transfer count.
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One roving-tabindex listbox grid (a tab's content). Exactly one option is
// tabbable (the last-focused, initially the first); arrows move focus AND the
// roving index; selection is explicit (Enter/Space), never following focus.
// ---------------------------------------------------------------------------

type ListboxGridProps = {
  label: string
  assets: AssetLite[]
  selected: Set<string>
  quotaFull: boolean
  onToggle: (id: string) => void
}

function ListboxGrid({
  label,
  assets,
  selected,
  quotaFull,
  onToggle,
}: ListboxGridProps) {
  const columns = useColumnCount()
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Clamp the roving index if the asset list shrinks beneath it.
  const clampedActive = activeIndex >= assets.length ? 0 : activeIndex

  function focusIndex(next: number): void {
    const clamped = Math.max(0, Math.min(assets.length - 1, next))
    setActiveIndex(clamped)
    const node =
      ref.current?.querySelectorAll<HTMLButtonElement>("[role='option']")[
        clamped
      ]
    node?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault()
        focusIndex(clampedActive + 1)
        break
      case "ArrowLeft":
        e.preventDefault()
        focusIndex(clampedActive - 1)
        break
      case "ArrowDown":
        e.preventDefault()
        focusIndex(clampedActive + columns)
        break
      case "ArrowUp":
        e.preventDefault()
        focusIndex(clampedActive - columns)
        break
      case "Home":
        e.preventDefault()
        focusIndex(0)
        break
      case "End":
        e.preventDefault()
        focusIndex(assets.length - 1)
        break
      case "Enter":
      case " ":
        e.preventDefault()
        {
          const asset = assets[clampedActive]
          if (asset) onToggle(asset.playerId)
        }
        break
      default:
        break
    }
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-multiselectable="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}
    >
      {assets.map((asset, i) => {
        const isSelected = selected.has(asset.playerId)
        return (
          <AssetCard
            key={asset.playerId}
            asset={asset}
            selected={isSelected}
            disabled={quotaFull && !isSelected}
            tabIndex={i === clampedActive ? 0 : -1}
            onClick={() => onToggle(asset.playerId)}
            onFocus={() => setActiveIndex(i)}
          />
        )
      })}
    </div>
  )
}
