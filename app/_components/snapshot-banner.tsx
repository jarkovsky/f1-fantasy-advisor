"use client"

import type { FeedProvenance } from "@/lib/advisor/types/contract"
import { formatDateISO } from "@/lib/format"

/**
 * Degradation notice for the advisor island — reuses the /stats DataAsOf visual
 * pattern (spec §8.4: degrade visibly, never crash). Renders only for snapshot
 * data; the live path renders nothing.
 */
export function SnapshotBanner({ meta }: { meta: FeedProvenance }) {
  if (meta.source === "live") return null

  const ms = meta.asOf ? Date.parse(meta.asOf) : NaN
  const label = Number.isNaN(ms) ? "an earlier capture" : formatDateISO(ms)

  return (
    <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      Live feed unavailable — showing snapshot data as of{" "}
      {Number.isNaN(ms) ? label : <time dateTime={new Date(ms).toISOString()}>{label}</time>}.
      Projections may be stale.
    </p>
  )
}
