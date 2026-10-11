import type { FeedProvenance } from "@/lib/advisor/types/contract"

import { StaleDataNotice } from "@/app/_components/shared/stale-data-notice"

/**
 * Degradation notice for the advisor island (spec §8.4: degrade visibly, never
 * crash). Renders only for snapshot data; the live path renders nothing.
 */
export function SnapshotBanner({ meta }: { meta: FeedProvenance }) {
  if (meta.source === "live") return null
  return <StaleDataNotice asOf={meta.asOf}>{" Projections may be stale."}</StaleDataNotice>
}
