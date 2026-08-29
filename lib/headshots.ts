/**
 * Server-only headshot path resolver.
 *
 * Headshots are OPTIONAL by design (spec: a missing/corrupt manifest must
 * degrade to monogram avatars, never crash a render). The manifest is read
 * ONCE at module scope — it is a static build artifact under public/, so a
 * single synchronous read at first import is correct and cheap; any failure
 * (missing file, bad JSON, unexpected shape) collapses to an empty map.
 *
 * Shape: public/headshots/manifest.json maps playerId → bundled filename, e.g.
 *   { "44": "44.png", "1": "max-verstappen.webp" }
 * headshotPath joins that to the public URL `/headshots/{file}`.
 */
import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

const MANIFEST_PATH = path.join(
  process.cwd(),
  "public",
  "headshots",
  "manifest.json"
)

function loadManifest(): Record<string, string> {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {}
    }
    const map: Record<string, string> = {}
    for (const [id, file] of Object.entries(parsed)) {
      if (typeof file === "string" && file.length > 0) map[id] = file
    }
    return map
  } catch {
    // Missing or corrupt manifest → headshots simply unavailable.
    return {}
  }
}

const manifest = loadManifest()

/** `/headshots/{file}` when this player has a bundled image, else null. */
export function headshotPath(playerId: string): string | null {
  const file = manifest[playerId]
  return file ? `/headshots/${file}` : null
}
