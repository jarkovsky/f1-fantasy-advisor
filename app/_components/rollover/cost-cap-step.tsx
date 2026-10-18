import type { UseCostCapInputReturn } from "@/hooks/use-cost-cap-input"

import { Card } from "@/components/ui/card"

import { CostCapInput } from "@/app/_components/shared/cost-cap-input"

/** Step 2: the new Remaining Cost Cap after price changes. */
export function CostCapStep({
  costCap,
  costCapInputRef,
  legendRef,
}: {
  costCap: UseCostCapInputReturn
  costCapInputRef: React.Ref<HTMLInputElement>
  legendRef: React.Ref<HTMLLegendElement>
}) {
  return (
    <Card className="gap-3 bg-surface-1 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend ref={legendRef} tabIndex={-1} className="text-sm font-semibold outline-none">
          What&apos;s your Remaining Cost Cap now?
        </legend>
        <CostCapInput
          value={costCap.value}
          onChange={costCap.setValue}
          aria-label="Remaining Cost Cap"
          inputRef={costCapInputRef}
        />
        <p className="text-xs text-muted-foreground">From F1 Fantasy, after price changes.</p>
      </fieldset>
    </Card>
  )
}
