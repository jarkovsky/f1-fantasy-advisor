/**
 * Downloads the season's team logos from the formula1.com media CDN into
 * public/logos/. Run via `pnpm assets` (tsx), commit the result.
 *
 * Two marks per constructor: the full-color logo for light surfaces and the
 * white logo for the carbon ones (several teams' color marks are black or
 * dark and vanish on carbon). Bundled as local static assets, like the
 * headshots: no runtime fetch, no hotlinking.
 *
 * Properties:
 * - Join key is the constructor's name in the latest committed snapshot,
 *   slugged the way formula1.com names its team asset folders ("Red Bull
 *   Racing" → "redbullracing", "Haas F1 Team" → "haasf1team"); files are named
 *   by the constructor playerId the UI already has.
 * - Never fails the run: a missing logo logs and continues, and the UI falls
 *   back to the team-color monogram. Always exits 0.
 * - This script is the only writer of public/logos/. Never part of
 *   `next build`. Idempotent: existing files are kept unless --force.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"

import { parseDriversFeed } from "@/lib/f1/schemas"

const SEASON = 2026
const CDN = `https://media.formula1.com/image/upload/c_fit,h_160/q_auto/v1740000001/common/f1/${SEASON}`
const VARIANTS = { color: "logo", white: "logowhite" } as const
const OUT_DIR = "public/logos"
const force = process.argv.includes("--force")

/** Constructor playerId → formula1.com asset slug, from the latest committed snapshot. */
async function constructorSlugs(): Promise<Map<string, string>> {
  const races = (await readdir("data/drivers"))
    .map((f) => Number.parseInt(f, 10))
    .filter(Number.isFinite)
  const latest = Math.max(...races)
  const raw: unknown = JSON.parse(await readFile(`data/drivers/${latest}.json`, "utf8"))
  const parsed = parseDriversFeed(raw)
  if (!parsed.ok) {
    throw new Error(`data/drivers/${latest}.json failed schema validation`)
  }
  return new Map(
    parsed.data
      .filter((a) => a.kind === "constructor")
      .map((a) => [a.playerId, a.fullName.toLowerCase().replace(/[^a-z0-9]/g, "")])
  )
}

const slugs = await constructorSlugs()
console.log(`· ${slugs.size} constructors in the latest snapshot`)

await mkdir(OUT_DIR, { recursive: true })
const manifest: Record<string, { color: string; white: string }> = {}
let downloaded = 0
let kept = 0

for (const [playerId, slug] of slugs) {
  const files = { color: `${playerId}.webp`, white: `${playerId}-white.webp` }
  let complete = true
  for (const [variant, suffix] of Object.entries(VARIANTS) as [keyof typeof VARIANTS, string][]) {
    const target = `${OUT_DIR}/${files[variant]}`
    if (existsSync(target) && !force) {
      kept += 1
      continue
    }
    const res = await fetch(`${CDN}/${slug}/${SEASON}${slug}${suffix}.webp`).catch(() => null)
    if (!res || !res.ok) {
      console.log(`· ${slug}: ${variant} logo unavailable (HTTP ${res?.status ?? "network error"})`)
      complete = false
      continue
    }
    await writeFile(target, Buffer.from(await res.arrayBuffer()))
    downloaded += 1
    console.log(`✓ ${target}`)
  }
  if (complete) manifest[playerId] = files
}

await writeFile(
  `${OUT_DIR}/manifest.json`,
  `${JSON.stringify(
    {
      attribution: "Team logos via formula1.com; trademarks of their owners",
      byPlayerId: manifest,
    },
    null,
    2
  )}\n`
)
console.log(
  `✓ ${OUT_DIR}/manifest.json — ${downloaded} downloaded, ${kept} kept, ${
    Object.keys(manifest).length
  } teams`
)
