import type { UseBankInputReturn } from "@/hooks/use-bank-input"

import { Card } from "@/components/ui/card"

import { BankInput } from "@/app/_components/shared/bank-input"

/** Step 2: the new remaining bank after price changes. */
export function BudgetStep({
  bank,
  bankInputRef,
  legendRef,
}: {
  bank: UseBankInputReturn
  bankInputRef: React.Ref<HTMLInputElement>
  legendRef: React.Ref<HTMLLegendElement>
}) {
  return (
    <Card className="gap-3 bg-surface-1 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend ref={legendRef} tabIndex={-1} className="text-sm font-semibold outline-none">
          What&apos;s your remaining budget now?
        </legend>
        <BankInput
          value={bank.value}
          onChange={bank.setValue}
          aria-label="Remaining budget"
          inputRef={bankInputRef}
        />
        <p className="text-xs text-muted-foreground">From F1 Fantasy, after price changes.</p>
      </fieldset>
    </Card>
  )
}
