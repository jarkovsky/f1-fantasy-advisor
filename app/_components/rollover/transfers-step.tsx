import type { ChipChoice, TransferChoice } from "@/hooks/use-rollover-form"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card } from "@/components/ui/card"

/** Step 3: the transfer allowance, with a chip sub-choice when "I played a chip". */
export function TransfersStep({
  transferChoice,
  setTransferChoice,
  chipChoice,
  setChipChoice,
  legendRef,
}: {
  transferChoice: TransferChoice | null
  setTransferChoice: (c: TransferChoice) => void
  chipChoice: ChipChoice | null
  setChipChoice: (c: ChipChoice) => void
  legendRef: React.Ref<HTMLLegendElement>
}) {
  return (
    <Card className="gap-3 bg-surface-1 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend ref={legendRef} tabIndex={-1} className="text-sm font-semibold outline-none">
          Transfers this week?
        </legend>
        <RadioGroup
          aria-label="Transfers this week?"
          className="flex flex-col gap-1.5"
          value={transferChoice ?? ""}
          onValueChange={(v) => setTransferChoice(v as TransferChoice)}
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="standard" />
            Standard (2 free)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="banked" />I banked a transfer (3 free)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="chip" />I played a chip
          </label>
        </RadioGroup>

        {transferChoice === "chip" && (
          <RadioGroup
            aria-label="Which chip?"
            className="flex flex-col gap-1.5 pl-6"
            value={chipChoice ?? ""}
            onValueChange={(v) => setChipChoice(v as ChipChoice)}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="wildcard" />
              Wildcard — unlimited this week
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="limitless" />
              Limitless — unlimited + budget ignored; your pre-chip roster comes back next week
            </label>
          </RadioGroup>
        )}
      </fieldset>
    </Card>
  )
}
