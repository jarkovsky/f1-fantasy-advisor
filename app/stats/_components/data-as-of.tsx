import type { FeedMeta } from "@/lib/f1/types/feed"

import { StaleDataNotice } from "@/app/_components/shared/stale-data-notice"

/**
 * Degradation notice for /stats — renders only when the data came from the
 * committed snapshot instead of the live feed (spec §8.4: degrade visibly,
 * never crash). meta.asOf is the HTTP Last-Modified (RFC1123), which parses
 * cleanly (unlike the feed's US-format FeedTime strings).
 */
export function DataAsOf({ meta }: { meta: FeedMeta }) {
  if (meta.source === "live") return null
  return <StaleDataNotice asOf={meta.asOf} />
}
