/**
 * Server-only headshot path + car number resolver.
 *
 * Headshots are optional by design: a missing/corrupt manifest must degrade to
 * monogram avatars, never crash a render. The manifest is read once at module
 * scope — it is a static build artifact under public/, so a single synchronous
 * read at first import is correct and cheap; any failure (missing file, bad
 * JSON, unexpected shape) collapses to an empty map.
 *
 * Shape (written by scripts/assets.ts — the only writer):
 *   { "attribution": "…", "byPlayerId": { "131": { "file": "131.png", "tla": "VER", "number": 3 } } }
 * headshotPath joins the file to the public URL `/headshots/{file}`; carNumber
 * is OpenF1's driver_number (the race number painted on the car).
 */
import "server-only"
import { readFileSync } from "node:fs"
import path from "node:path"

const MANIFEST_PATH = path.join(process.cwd(), "public", "headshots", "manifest.json")

type ManifestEntry = { file: string | null; number: number | null }

function loadManifest(): Record<string, ManifestEntry> {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8")
    const parsed = JSON.parse(raw) as {
      byPlayerId?: Record<string, { file?: unknown; number?: unknown }>
    }
    const entries = parsed?.byPlayerId
    if (entries === null || typeof entries !== "object") return {}
    const map: Record<string, ManifestEntry> = {}
    for (const [id, entry] of Object.entries(entries)) {
      const file = typeof entry?.file === "string" && entry.file.length > 0 ? entry.file : null
      const number = Number.isInteger(entry?.number) ? (entry.number as number) : null
      map[id] = { file, number }
    }
    return map
  } catch {
    // Missing or corrupt manifest → headshots and numbers simply unavailable.
    return {}
  }
}

const manifest = loadManifest()

/** `/headshots/{file}` when this player has a bundled image, else null. */
export function headshotPath(playerId: string): string | null {
  const file = manifest[playerId]?.file
  return file ? `/headshots/${file}` : null
}

/** The driver's race number from the manifest, else null (constructors, unmatched drivers). */
export function carNumber(playerId: string): number | null {
  return manifest[playerId]?.number ?? null
}
