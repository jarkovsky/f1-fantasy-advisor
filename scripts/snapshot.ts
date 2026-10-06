/**
 * Refreshes the committed feed snapshots in data/ from the live F1 Fantasy
 * CDN. Run via `pnpm snapshot` (tsx), commit the result.
 *
 * These snapshots are the offline/degradation fallback: `'use cache'`
 * fetchers execute at build time, so the build must succeed with zero
 * network — it falls back to these files.
 *
 * Properties:
 * - Every payload is validated through the REAL parse functions before being
 *   written — a malformed live feed can never become a committed fallback.
 * - Drivers feeds are fetched race 1..N until the first 403 (403 = not yet
 *   published, expected for future races — not an error).
 * - This script is the ONLY writer of data/. It is never part of `next build`.
 */
import { mkdir, writeFile } from "node:fs/promises"

import { F1_FEED_BASE, FEED_NOT_PUBLISHED_STATUS, FEED_UA, feedPaths } from "@/lib/f1/config"
import {
  type ParseResult,
  parseConstraints,
  parseDriversFeed,
  parseMixapi,
  parseRaceday,
} from "@/lib/f1/schemas"

type ManifestEntry = {
  lastModified: string | null
  etag: string | null
  fetchedAt: string
}

const manifest: Record<string, ManifestEntry> = {}

async function grab(
  path: string,
  file: string,
  parse: (raw: unknown) => ParseResult<unknown>
): Promise<boolean> {
  const res = await fetch(F1_FEED_BASE + path, {
    headers: { "user-agent": FEED_UA },
  })
  if (res.status === FEED_NOT_PUBLISHED_STATUS) return false
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)

  const text = await res.text()
  const parsed = parse(JSON.parse(text))
  if (!parsed.ok) {
    throw new Error(`${path} failed schema validation:\n  ${parsed.summary.join("\n  ")}`)
  }

  await writeFile(`data/${file}`, text)
  manifest[file] = {
    lastModified: res.headers.get("last-modified"),
    etag: res.headers.get("etag"),
    fetchedAt: new Date().toISOString(),
  }
  console.log(`✓ data/${file} (${(text.length / 1024).toFixed(1)} KB)`)
  return true
}

await mkdir("data/drivers", { recursive: true })

let race = 1
for (;;) {
  const published = await grab(feedPaths.drivers(race), `drivers/${race}.json`, parseDriversFeed)
  if (!published) {
    console.log(`· race ${race} not yet published (403) — snapshot range is 1..${race - 1}`)
    break
  }
  race += 1
}

await grab(feedPaths.constraints(), "constraints.json", parseConstraints)
await grab(feedPaths.raceday(), "raceday.json", parseRaceday)
await grab(feedPaths.mixapi(), "mixapi.json", parseMixapi)

await writeFile("data/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`✓ data/manifest.json (${Object.keys(manifest).length} entries)`)
console.log(
  "\nReminder: if a NEW drivers/{race}.json appeared, add its static import to lib/f1/snapshot-data.ts (the drift test will catch it otherwise)."
)
