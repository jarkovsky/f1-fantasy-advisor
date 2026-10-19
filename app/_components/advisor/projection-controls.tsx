"use client"

import type { ProjectionResult } from "@/lib/projections/types/projection"
import type { PresetId } from "@/lib/projections/types/presets"

import { ArrowUpRight } from "lucide-react"

import { PRESET_REGISTRY } from "@/lib/projections/engine"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"

import { InfoTip } from "@/app/_components/shared/info-tip"

/** The plain-language explainer, on GitHub so it reads well outside the app. */
const MODELS_DOC_URL =
  "https://github.com/jarkovsky/f1-fantasy-advisor/blob/main/docs/projection-models.md"

type ProjectionControlsProps = {
  preset: PresetId
  onPresetChange: (id: PresetId) => void
  blendWeight: number
  onBlendWeightChange: (w: number) => void
  projection: ProjectionResult
}

/**
 * The projection model panel under the team comparison: the preset picker
 * (history presets greyed at cold start / below their minimum race count) and
 * the custom-blend weight slider. A confidence line states the sample size and
 * warns at cold start.
 */
export function ProjectionControls({
  preset,
  onPresetChange,
  blendWeight,
  onBlendWeightChange,
  projection,
}: ProjectionControlsProps) {
  const { coldStart, basis } = projection
  const { completedRaces, completedSprints } = basis

  const percentRecent = Math.round(blendWeight * 100)
  const selected = PRESET_REGISTRY.find((def) => def.id === preset)

  return (
    <Card className="gap-4 bg-surface-1 p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">Projection model</h2>
        <InfoTip label="the projection model">
          How each driver&apos;s and constructor&apos;s points are projected for this race week. The
          recommended team re-optimizes as soon as you change it.
        </InfoTip>
      </div>

      <div className="flex flex-1 flex-col gap-3">
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

        {selected && <p className="text-sm text-pretty">{selected.description}</p>}

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
              <span className="font-mono tabular-nums">{percentRecent}% recent</span>
              <span>Weighted recent</span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Based on {completedRaces} completed race
          {completedRaces === 1 ? "" : "s"}
          {completedSprints > 0
            ? `, ${completedSprints} sprint${completedSprints === 1 ? "" : "s"}`
            : ""}
          .{coldStart && <> Race 1 — no history yet; projections use price-based Equal PPM.</>}
        </p>

        <a
          href={MODELS_DOC_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-auto flex w-fit items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          How the models work
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </Card>
  )
}
