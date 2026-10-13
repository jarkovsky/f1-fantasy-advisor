import type { FreeTransfers } from "@/hooks/use-team-draft"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const OPTIONS: { value: string; label: string }[] = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "unlimited", label: "Unlimited" },
]

/**
 * Free-transfers selector: a single-select ToggleGroup, which Radix exposes as a
 * radiogroup with arrow-key navigation. A value is always selected, so the empty
 * onValueChange from clicking the active item is ignored to keep radio semantics.
 */
export function FreeTransfersField({
  value,
  onChange,
}: {
  value: FreeTransfers
  onChange: (v: FreeTransfers) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">Free transfers</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Free transfers"
        value={String(value)}
        onValueChange={(v) => {
          if (v === "") return
          onChange(v === "unlimited" ? "unlimited" : (Number(v) as 2 | 3))
        }}
        className="gap-1.5"
      >
        {OPTIONS.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value}>
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        3 only if you banked an unused transfer last week; none carry over after Wildcard or
        Limitless. Unlimited = your first race or an active Wildcard.
      </p>
    </fieldset>
  )
}
