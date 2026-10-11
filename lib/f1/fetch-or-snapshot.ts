import type { Feed, ParseResult, Snapshot } from "./types/feed"

/**
 * The degradation core of the data layer: try the live feed, fall back to the
 * committed snapshot, NEVER throw.
 *
 * This guarantee is what makes the offline build work: `'use cache'` fetchers
 * execute at build time, and a build machine with no network must still
 * produce a working app (rendering snapshot data with provenance).
 *
 * Deliberately NOT `server-only`: this module is pure(ish) and directly
 * unit-tested with an injected fetchImpl — the server-only fence lives in
 * feed.ts, the only production caller.
 */
import { F1_FEED_BASE, FEED_TIMEOUT_MS, FEED_UA } from "./config"

export type FetchOrSnapshotOptions = {
  fetchImpl?: typeof fetch
  /** Last-resort value when live fails AND no/invalid snapshot exists. */
  empty: unknown
}

export async function fetchOrSnapshot<T>(
  path: string,
  parse: (raw: unknown) => ParseResult<T>,
  snapshot: () => Snapshot | null,
  options: FetchOrSnapshotOptions,
  race?: number
): Promise<Feed<T>> {
  const fetchImpl = options.fetchImpl ?? fetch

  // 1. Live.
  try {
    const res = await fetchImpl(F1_FEED_BASE + path, {
      headers: { "user-agent": FEED_UA },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    })
    if (res.ok) {
      const json: unknown = await res.json() // may throw → caught below
      const parsed = parse(json)
      if (parsed.ok) {
        if (parsed.dropped) {
          console.warn(`[f1-feed] ${path}: dropped ${parsed.dropped} corrupt row(s)`)
        }
        return {
          data: parsed.data,
          meta: {
            source: "live",
            asOf: res.headers.get("last-modified") ?? "",
            race,
          },
        }
      }
      console.warn(
        `[f1-feed] ${path} live payload failed schema, degrading to snapshot:\n  ${parsed.summary.slice(0, 5).join("\n  ")}`
      )
    } else {
      // 403 = race not yet published (S3 deny) — expected, not an error.
      console.warn(`[f1-feed] ${path} → HTTP ${res.status}, degrading to snapshot`)
    }
  } catch (err) {
    // Network down, DNS failure, timeout, malformed JSON body.
    console.warn(`[f1-feed] ${path} fetch failed (${String(err)}), degrading to snapshot`)
  }

  // 2. Committed snapshot (schema-validated when written, re-parsed defensively).
  const snap = snapshot()
  if (snap) {
    const parsed = parse(snap.raw)
    if (parsed.ok) {
      return {
        data: parsed.data,
        meta: { source: "snapshot", asOf: snap.asOf, race },
      }
    }
    console.error(`[f1-feed] ${path} snapshot ALSO failed schema — serving empty value`)
  }

  // 3. Last resort: typed empty value. Dead branch for races within the
  // snapshot range; exists so this function provably cannot throw.
  return {
    data: options.empty as T,
    meta: { source: "snapshot", asOf: "", race },
  }
}

/**
 * Probe whether a feed path is published, by HTTP status alone.
 *
 * Exists because getDrivers (via fetchOrSnapshot) CANNOT answer "is race N+1
 * published?": it degrades a 403 to the committed snapshot, swallowing the
 * status. Unpublished races return 403 (S3 deny-on-missing-key), not 404, so
 * status is the only signal — but it never surfaces through the degradation
 * path. This probe reads status only (no body) and reports res.ok.
 *
 * Like fetchOrSnapshot, it NEVER throws: every failure mode (403, 5xx, network
 * error, timeout/abort) collapses to false. It runs inside a 'use cache' scope
 * at build time, where a throw would abort prerender.
 */
export async function probeFeedPublished(
  path: string,
  opts?: { fetchImpl?: typeof fetch }
): Promise<boolean> {
  const fetchImpl = opts?.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(F1_FEED_BASE + path, {
      headers: { "user-agent": FEED_UA },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    // Network down, DNS failure, timeout/abort — treat as not published.
    return false
  }
}
