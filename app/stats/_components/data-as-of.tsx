import type { FeedMeta } from "@/lib/f1/fetch-or-snapshot"

/**
 * Degradation notice — renders only when the data came from the committed
 * snapshot instead of the live feed (spec §8.4: degrade visibly, never crash).
 */
export function DataAsOf({ meta }: { meta: FeedMeta }) {
  if (meta.source === "live") return null

  // meta.asOf is the HTTP Last-Modified (RFC1123) — parseable, unlike the
  // feed's US-format FeedTime strings.
  const date = meta.asOf ? new Date(meta.asOf) : null
  const label =
    date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "an earlier capture"

  return (
    <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      Live feed unavailable — showing snapshot data as of{" "}
      {date && !Number.isNaN(date.getTime()) ? (
        <time dateTime={date.toISOString()}>{label}</time>
      ) : (
        label
      )}
      .
    </p>
  )
}
