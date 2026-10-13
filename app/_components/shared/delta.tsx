import { formatDeltaTenths, formatSignedPoints } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Signed numeric delta with a sign glyph and a sentiment color. The sign (+ / −)
 * is always part of the text, so color only reinforces it and is never the sole
 * carrier of meaning. Zero renders as a muted middle dot `·`.
 */
type DeltaProps =
  | { value: number; points: true; tenths?: never; className?: string }
  | { value: number; tenths: true; points?: never; className?: string }

export function Delta(props: DeltaProps) {
  const { value, className } = props
  const text = props.points ? formatSignedPoints(value) : formatDeltaTenths(value)

  // Tone follows the displayed text: a points delta that rounds to zero shows
  // the neutral "·" and must not be colored as a gain or a loss.
  const tone = text === "·" ? "text-muted-foreground" : value > 0 ? "text-pos" : "text-neg"

  return <span className={cn("tabular-nums", tone, className)}>{text}</span>
}
