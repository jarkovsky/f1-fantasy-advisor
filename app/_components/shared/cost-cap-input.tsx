import { Input } from "@/components/ui/input"

/**
 * The "$ [number] M" Remaining Cost Cap row shared by the team picker and the
 * rollover form. Presentational only — the caller owns the value/label/help
 * text and the parsing (useCostCapInput). Accepts either an `id` (paired with an
 * external <label htmlFor>) or an `aria-label`.
 */
export function CostCapInput({
  id,
  value,
  onChange,
  onBlur,
  "aria-label": ariaLabel,
  inputRef,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  "aria-label"?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="font-mono text-muted-foreground">
        $
      </span>
      <Input
        ref={inputRef}
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={0.1}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-32 font-mono text-sm tabular-nums"
      />
      <span className="font-mono text-sm text-muted-foreground">M</span>
    </div>
  )
}
