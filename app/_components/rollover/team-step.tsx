import type { TeamChoice } from "@/hooks/use-rollover-form"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card } from "@/components/ui/card"

import { UnavailableAssetTile } from "@/app/_components/shared/unavailable-asset-tile"
import { TeamPicker } from "@/app/_components/team-picker/team-picker"
import { LineupRow } from "@/app/_components/shared/lineup-row"
import { Delta } from "@/app/_components/shared/delta"

/** Step 1: confirm the team at new prices, or open the picker to edit it. */
export function TeamStep({
  resolved,
  unresolvedIds,
  teamChoice,
  onKeep,
  onEdit,
  editing,
  assets,
  raceNumber,
  onEditorDone,
}: {
  resolved: AssetLite[]
  unresolvedIds: string[]
  teamChoice: TeamChoice | null
  onKeep: () => void
  onEdit: () => void
  editing: boolean
  assets: AssetLite[]
  raceNumber: number
  onEditorDone: () => void
}) {
  return (
    <>
      <Card className="gap-3 bg-surface-1 p-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">Did your team change?</legend>

          <ul className="flex flex-col gap-0.5">
            {resolved.map((a) => (
              <LineupRow key={a.playerId} color={teamColor(assetColorKey(a))} name={a.displayName}>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatPriceTenths(a.priceTenths)}
                </span>
                <Delta
                  value={a.priceTenths - a.prevPriceTenths}
                  tenths
                  className="font-mono text-xs"
                />
              </LineupRow>
            ))}
          </ul>

          {unresolvedIds.length > 0 && (
            <div className="flex flex-col gap-2">
              {unresolvedIds.map((id) => (
                <UnavailableAssetTile key={id} id={id} onReplace={onEdit} />
              ))}
            </div>
          )}

          <RadioGroup
            aria-label="Did your team change?"
            className="flex flex-col gap-1.5"
            value={teamChoice ?? ""}
            onValueChange={(v) => (v === "kept" ? onKeep() : onEdit())}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="kept" />I kept this exact team
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="edit" />I made transfers — let me edit
            </label>
          </RadioGroup>
        </fieldset>
      </Card>

      {/* The picker renders its own Card, so it sits between the step cards
          rather than nested inside step 1. */}
      {editing && (
        <TeamPicker assets={assets} raceNumber={raceNumber} mode="edit" onDone={onEditorDone} />
      )}
    </>
  )
}
