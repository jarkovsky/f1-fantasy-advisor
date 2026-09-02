/**
 * Server-only headshot path resolver.
 *
 * Headshots are OPTIONAL by design (spec: a missing/corrupt manifest must
 * degrade to monogram avatars, never crash a render). The manifest is read
 * ONCE at module scope — it is a static build artifact under public/, so a
 * single synchronous read at first import is correct and cheap; any failure
 * (missing file, bad JSON, unexpected shape) collapses to an empty map.
 *
 * Shape (written by scripts/assets.ts — the only writer):
 *   { "attribution": "…", "byPlayerId": { "131": { "file": "131.png", "tla": "VER" } } }
 * headshotPath joins the file to the public URL `/headshots/{file}`.
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
    const parsed = JSON.parse(raw) as {
      byPlayerId?: Record<string, { file?: unknown }>
    }
    const entries = parsed?.byPlayerId
    if (entries === null || typeof entries !== "object") return {}
    const map: Record<string, string> = {}
    for (const [id, entry] of Object.entries(entries)) {
      if (typeof entry?.file === "string" && entry.file.length > 0) {
        map[id] = entry.file
      }
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
