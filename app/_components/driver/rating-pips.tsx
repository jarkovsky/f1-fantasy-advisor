import type { SessionRating } from "@/lib/profile/types/profile"

import { RATING_STEPS } from "@/lib/constants"
import { formatOrdinal } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A 5-pip meter for where a driver's average session points rank in the grid
 * (lib/profile/ratings.ts). The pips are one image to assistive tech, labelled
 * with the rank they encode; sighted users get the same through the tooltip.
 */
export function RatingPips({ rating, session }: { rating: SessionRating | null; session: string }) {
  if (rating === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const label = `${rating.rating} of ${RATING_STEPS}: ${formatOrdinal(rating.rank)} of ${rating.of} by average ${session} points (${rating.avg.toFixed(1)})`
  return (
    <span role="img" aria-label={label} title={label} className="flex items-center gap-[3px]">
      {Array.from({ length: RATING_STEPS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-3.5 w-1.5 rounded-[2px]",
            i < rating.rating ? "bg-warn" : "bg-grid-line-strong"
          )}
        />
      ))}
    </span>
  )
}
