import { formatDeltaTenths, formatSignedPoints } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Signed numeric delta with a sign glyph and a sentiment color (spec §10).
 *
 * COLOR NEVER WITHOUT THE GLYPH: the sign (+ / −) is always part of the text,
 * so color is decorative reinforcement, never the sole information carrier.
 * Exact zero renders a bare middle dot `·` in muted color (no value churn).
 */
type DeltaProps =
  | { value: number; points: true; tenths?: never; className?: string }
  | { value: number; tenths: true; points?: never; className?: string }

export function Delta(props: DeltaProps) {
  const { value, className } = props
  const text =
    "points" in props && props.points ? formatSignedPoints(value) : formatDeltaTenths(value)

  const tone = value > 0 ? "text-pos" : value < 0 ? "text-neg" : "text-muted-foreground"

  return <span className={cn("tabular-nums", tone, className)}>{text}</span>
}
