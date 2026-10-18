"use client"

import type { AssetLite } from "@/lib/asset-lite"

import { useId, useMemo, useState } from "react"

import { TEAM_CONSTRUCTORS, TEAM_DRIVERS } from "@/lib/constants"
import { formatPriceTenths } from "@/lib/format"
import { useTeamStore } from "@/lib/team/store"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useTeamDraft } from "@/hooks/use-team-draft"

import { CostCapInput } from "@/app/_components/shared/cost-cap-input"

import { FreeTransfersField } from "./free-transfers-field"
import { StartOverDialog } from "./start-over-dialog"
import { PickerTable } from "./picker-table"

/**
 * The team-setup flow as one Card: Drivers and Constructors tables on the left,
 * filtered by a shared search box, and a control column on the right (selection
 * summary, Remaining Cost Cap, free transfers, status, Save). Selection is a local
 * draft (useTeamDraft); nothing touches the store until Save.
 *
 * This container owns selection and validation; <PickerTable> only renders.
 * The only blockers are an incomplete team (exactly 5 drivers + 2
 * constructors) and a Remaining Cost Cap that hasn't been entered. Spending over the $100M
 * starting cap is deliberately not blocked: mid-season price changes make the
 * real limit team value + Remaining Cost Cap, not the starting cap.
 */

type TeamPickerProps = {
  assets: AssetLite[]
  raceNumber: number
  mode: "first-run" | "edit"
  onDone?: () => void
}

export function TeamPicker({ assets, raceNumber, mode, onDone }: TeamPickerProps) {
  const { setTeam, reset } = useTeamStore()
  const { selected, setSelected, costCap, freeTransfers, setFreeTransfers } = useTeamDraft(mode)
  const costCapId = useId()

  const byId = useMemo(() => new Map(assets.map((a) => [a.playerId, a])), [assets])

  const [query, setQuery] = useState("")
  const drivers = useMemo(() => assets.filter((a) => a.kind === "driver"), [assets])
  const constructors = useMemo(() => assets.filter((a) => a.kind === "constructor"), [assets])

  // Ids are sorted so the saved lineup order is deterministic: drivers then
  // constructors, each ascending by id.
  const { driverIds, constructorIds, teamValueTenths } = useMemo(() => {
    const pickedDrivers: string[] = []
    const pickedConstructors: string[] = []
    let value = 0
    for (const id of selected) {
      const asset = byId.get(id)
      if (!asset) continue
      value += asset.priceTenths
      if (asset.kind === "driver") pickedDrivers.push(id)
      else pickedConstructors.push(id)
    }
    return {
      driverIds: pickedDrivers.sort(),
      constructorIds: pickedConstructors.sort(),
      teamValueTenths: value,
    }
  }, [selected, byId])

  const driverCount = driverIds.length
  const constructorCount = constructorIds.length
  const driversFull = driverCount >= TEAM_DRIVERS
  const constructorsFull = constructorCount >= TEAM_CONSTRUCTORS

  const teamComplete = driverCount === TEAM_DRIVERS && constructorCount === TEAM_CONSTRUCTORS
  const blocked = !teamComplete || !costCap.entered
  const liveMessage = statusMessage(teamComplete, costCap.entered, driverCount, constructorCount)

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      const asset = byId.get(id)
      if (!asset) return next
      // The table already disables rows at quota; this keeps the invariant
      // regardless of how a toggle arrives.
      if (asset.kind === "driver" && driversFull) return next
      if (asset.kind === "constructor" && constructorsFull) return next
      next.add(id)
      return next
    })
  }

  function handleSave(): void {
    if (blocked) return
    setTeam([...driverIds, ...constructorIds], costCap.tenths, freeTransfers, raceNumber)
    onDone?.()
  }

  function handleStartOver(): void {
    reset()
    onDone?.()
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* Live region: present from first render so changes are announced. */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
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

          <div className="flex flex-col gap-5 lg:border-l lg:border-grid-line lg:pl-6">
            <p className="font-mono text-sm tabular-nums">
              Drivers {driverCount}/{TEAM_DRIVERS} · Constructors {constructorCount}/
              {TEAM_CONSTRUCTORS} · Spent {formatPriceTenths(teamValueTenths)}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={costCapId} className="text-sm font-medium">
                Remaining Cost Cap
              </label>
              <CostCapInput
                id={costCapId}
                value={costCap.value}
                onChange={costCap.setValue}
                onBlur={costCap.normalize}
              />
              <p className="text-xs text-muted-foreground">
                Your Remaining Cost Cap in F1 Fantasy, after any transfers you already made.
              </p>
            </div>

            <FreeTransfersField value={freeTransfers} onChange={setFreeTransfers} />

            <div className="flex items-center gap-2">
              {blocked ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                  {teamComplete ? "Enter Remaining Cost Cap" : "Team incomplete"}
                </span>
              ) : (
                <span className="rounded-full bg-accent-f1-quiet px-2 py-0.5 text-xs text-accent-f1">
                  Ready
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button type="button" variant="primary-f1" disabled={blocked} onClick={handleSave}>
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

/** The polite live-region copy: what still blocks Save, or that the team is ready. */
function statusMessage(
  teamComplete: boolean,
  costCapEntered: boolean,
  driverCount: number,
  constructorCount: number
): string {
  if (!teamComplete) {
    return `${TEAM_DRIVERS} drivers and ${TEAM_CONSTRUCTORS} constructors required — you have ${driverCount} drivers and ${constructorCount} constructors.`
  }
  if (!costCapEntered) return "Team complete — enter your Remaining Cost Cap."
  return "Team valid — recommendations ready."
}
