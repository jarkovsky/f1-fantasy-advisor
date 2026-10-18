/**
 * Server-only team logo resolver.
 *
 * Logos are optional by design, like the headshots: a missing/corrupt
 * manifest degrades to the team-color monogram, never a crashed render. The
 * manifest is a static build artifact under public/, read once at module scope;
 * any failure collapses to an empty map.
 *
 * Shape (written by scripts/team-logos.ts — the only writer):
 *   { "attribution": "…", "byPlayerId": { "27": { "color": "27.webp", "white": "27-white.webp" } } }
 * keyed by constructor playerId (a driver joins on its constructorId).
 */
import "server-only"
import type { TeamLogo } from "@/lib/asset-lite"

import { readFileSync } from "node:fs"
import path from "node:path"

const MANIFEST_PATH = path.join(process.cwd(), "public", "logos", "manifest.json")

function loadManifest(): Record<string, TeamLogo> {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8")
    const parsed = JSON.parse(raw) as {
      byPlayerId?: Record<string, { color?: unknown; white?: unknown }>
    }
    const entries = parsed?.byPlayerId
    if (entries === null || typeof entries !== "object") return {}
    const map: Record<string, TeamLogo> = {}
    for (const [id, entry] of Object.entries(entries)) {
      if (typeof entry?.color === "string" && typeof entry.white === "string") {
        map[id] = { color: `/logos/${entry.color}`, white: `/logos/${entry.white}` }
      }
    }
    return map
  } catch {
    // Missing or corrupt manifest → logos simply unavailable.
    return {}
  }
}

const manifest = loadManifest()

/** Both marks for a constructor (or a driver's constructorId), else null. */
export function teamLogo(constructorId: string | null): TeamLogo | null {
  return constructorId === null ? null : (manifest[constructorId] ?? null)
}
