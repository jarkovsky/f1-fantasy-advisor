import type { FeedProvenance } from "@/lib/advisor/types/contract"

import { StaleDataNotice } from "@/app/_components/shared/stale-data-notice"

/**
 * Degradation notice for the advisor island: when any feed fell back to the
 * committed snapshot, say so rather than silently serving stale numbers.
 * Renders nothing for live data.
 */
export function SnapshotBanner({ meta }: { meta: FeedProvenance }) {
  if (meta.source === "live") return null
  return <StaleDataNotice asOf={meta.asOf}>{" Projections may be stale."}</StaleDataNotice>
}
