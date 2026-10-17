import type { SelectionTrend } from "@/lib/profile/types/profile"

import { sentimentPosition } from "@/lib/profile/sentiment"
import { cn } from "@/lib/utils"

function describe({ selectedPercent, change, races }: SelectionTrend): string {
  const base = `Selected by ${selectedPercent}% of teams`
  if (change === null) return `${base}; no trend yet`
  if (change === 0) return `${base}, unchanged over the last ${races} races`
  const pts = Math.abs(change)
  return `${base}, ${change > 0 ? "up" : "down"} ${pts} point${pts === 1 ? "" : "s"} over the last ${races} race${races === 1 ? "" : "s"}`
}

/**
 * A centered needle: the crowd's selection trend, bullish to the right
 * (green), bearish to the left (red). The bar is decoration; the sentence
 * that drives it is the accessible name and the tooltip, and the current
 * selection % stays visible as text, so color never carries it alone.
 */
export function SentimentMeter({ sentiment }: { sentiment: SelectionTrend }) {
  const position = sentimentPosition(sentiment.change)
  const pct = 50 + position * 50
  const tone =
    sentiment.change === null || sentiment.change === 0
      ? "bg-muted-foreground"
      : sentiment.change > 0
        ? "bg-pos"
        : "bg-neg"
  const label = describe(sentiment)

  return (
    <span role="img" aria-label={label} title={label} className="flex items-center gap-2">
      <span className="relative h-1 w-14 rounded-full bg-grid-line-strong">
        <span className="absolute top-1/2 left-1/2 h-2.5 w-px -translate-y-1/2 bg-muted-foreground/50" />
        <span
          className={cn("absolute inset-y-0 rounded-full", tone)}
          style={{ left: `${Math.min(50, pct)}%`, right: `${100 - Math.max(50, pct)}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-0",
            tone
          )}
          style={{ left: `${pct}%` }}
        />
      </span>
      <span className="text-xs text-muted-foreground">{sentiment.selectedPercent}%</span>
    </span>
  )
}
