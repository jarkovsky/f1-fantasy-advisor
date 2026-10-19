"use client"

import type { WhatIfMode } from "@/lib/advisor/types/contract"

import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"

import { InfoTip } from "@/app/_components/shared/info-tip"

const CHIPS: { mode: Exclude<WhatIfMode, "none">; name: string; effect: string }[] = [
  {
    mode: "wildcard",
    name: "Wildcard",
    effect: "Unlimited free transfers within your Cost Cap. The new team stays.",
  },
  {
    mode: "limitless",
    name: "Limitless",
    effect: "Unlimited transfers and no Cost Cap for one race week, then your team reverts.",
  },
]

/**
 * The chip previews: Wildcard and Limitless as mutually exclusive switches.
 * Switching one on re-optimizes the recommended team as if the chip were
 * played; it stays a hypothetical (the comparison can't apply it), because
 * playing a chip happens in the official game.
 */
export function ChipPreview({
  whatIf,
  onWhatIfChange,
}: {
  whatIf: WhatIfMode
  onWhatIfChange: (mode: WhatIfMode) => void
}) {
  return (
    <Card className="gap-4 bg-surface-1 p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">Chips</h2>
        <InfoTip label="chips">
          See the recommended team as if you played a chip this race week. Nothing is saved; play
          the chip in the official game.
        </InfoTip>
      </div>
      <div className="flex flex-col gap-4">
        {CHIPS.map(({ mode, name, effect }) => (
          <label key={mode} className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{effect}</span>
            </span>
            <Switch
              checked={whatIf === mode}
              onCheckedChange={(on) => onWhatIfChange(on ? mode : "none")}
              aria-label={`Preview the ${name} chip`}
            />
          </label>
        ))}
      </div>
    </Card>
  )
}
