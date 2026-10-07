/**
 * The feed-boundary contract: a parse Result in, a provenance-stamped Feed out,
 * and the Snapshot shape of the committed fallback.
 *
 * Pure types with zero imports — importable from server-only modules
 * (snapshot-data.ts, feed.ts) and un-fenced testable ones (fetch-or-snapshot.ts)
 * alike. Keeping the Snapshot shape here is what lets fetch-or-snapshot.ts stay
 * un-fenced while snapshot-data.ts is server-only.
 */

export type ParseResult<T> =
  | { ok: true; data: T; dropped?: number }
  | { ok: false; summary: string[] }

export type DataSource = "live" | "snapshot"

export type FeedMeta = {
  source: DataSource
  /** HTTP Last-Modified (RFC1123) of whichever payload was used; '' if unknown. */
  asOf: string
  race?: number
}

export type Feed<T> = { data: T; meta: FeedMeta }

export type Snapshot = { raw: unknown; asOf: string }
