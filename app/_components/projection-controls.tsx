"use client"

import type { WhatIfMode } from "@/lib/advisor/types/contract"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { PRESET_REGISTRY } from "@/lib/projections/engine"
import type { PresetId } from "@/lib/projections/types/presets"
import type { ProjectionResult } from "@/lib/projections/types/projection"

/**
 * The "Advanced" projection controls: the model preset picker (history presets
 * greyed at cold start / below their minimum race count), the custom-blend
 * weight slider, and the two mutually-exclusive what-if chips (Wildcard /
 * Limitless — hypotheticals only, never saved). A confidence line states the
 * sample size and warns at cold start.
 */
type ProjectionControlsProps = {
  preset: PresetId
  onPresetChange: (id: PresetId) => void
  blendWeight: number
  onBlendWeightChange: (w: number) => void
  whatIf: WhatIfMode
  onWhatIfChange: (mode: WhatIfMode) => void
  projection: ProjectionResult
}

export function ProjectionControls({
  preset,
  onPresetChange,
  blendWeight,
  onBlendWeightChange,
  whatIf,
  onWhatIfChange,
  projection,
}: ProjectionControlsProps) {
  const { coldStart, basis } = projection
  const { completedRaces, completedSprints } = basis

  const percentRecent = Math.round(blendWeight * 100)

  return (
    <Card className="gap-4 bg-surface-1 p-4">
      <h2 className="text-sm font-semibold">Advanced</h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Projection model</span>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as PresetId)}>
          <SelectTrigger className="w-full" aria-label="Projection model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_REGISTRY.map((def) => {
              const gated = def.historyBased && (coldStart || completedRaces < def.minRaces)
              return (
                <SelectItem key={def.id} value={def.id} disabled={gated}>
                  {def.label}
                  {gated && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      needs ≥{def.minRaces} completed race
                    </span>
                  )}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom-blend" && (
        <div className="flex flex-col gap-2">
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[blendWeight]}
            onValueChange={(v) => {
              const w = v[0]
              if (w !== undefined) onBlendWeightChange(w)
            }}
            aria-label="Blend"
            aria-valuetext={`${percentRecent}% recent form`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Season average</span>
            <span aria-hidden="true">↔</span>
            <span>Weighted recent</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            Blend: {blendWeight.toFixed(2)}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-grid-line pt-3">
        <label className="flex items-center justify-between text-sm">
          <span>Wildcard (what-if)</span>
          <Switch
            checked={whatIf === "wildcard"}
            onCheckedChange={(on) => onWhatIfChange(on ? "wildcard" : "none")}
            aria-label="Wildcard (what-if)"
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>Limitless (what-if)</span>
          <Switch
            checked={whatIf === "limitless"}
            onCheckedChange={(on) => onWhatIfChange(on ? "limitless" : "none")}
            aria-label="Limitless (what-if)"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Hypothetical — explores the chip without saving.
        </p>
      </div>

      <p className="border-t border-grid-line pt-3 text-xs text-muted-foreground">
        Based on {completedRaces} completed race
        {completedRaces === 1 ? "" : "s"}
        {completedSprints > 0
          ? `, ${completedSprints} sprint${completedSprints === 1 ? "" : "s"}`
          : ""}
        .{coldStart && <> Race 1 — no history yet; projections use price-based Equal PPM.</>}
      </p>
    </Card>
  )
}
