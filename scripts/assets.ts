/**
 * Downloads driver headshots from OpenF1 into public/headshots/. Run via
 * `pnpm assets` (tsx), commit the result.
 *
 * Headshots are bundled as local static assets (no runtime fetch, no CORS,
 * no hotlinking). OpenF1 data is CC BY-NC-SA — the footer credit in
 * app/_components/chrome/footer.tsx is a license obligation, not cosmetics.
 *
 * Properties:
 * - Never fails the run: every failure (OpenF1 restricts global API access
 *   while a live F1 session is running, network down, unmatched driver) logs
 *   and continues; the UI falls back to monogram avatars for any missing
 *   file. Always exits 0.
 * - Join key is the driver TLA: OpenF1 `name_acronym` ↔ our feed's
 *   `Asset.tla`, resolved to `playerId` via the committed snapshot so files
 *   are named by the stable id the UI already has.
 * - This script is the only writer of public/headshots/. Never part of
 *   `next build`. Idempotent: existing files are kept unless --force.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"

import { parseDriversFeed } from "@/lib/f1/schemas"

const OPENF1_DRIVERS = "https://api.openf1.org/v1/drivers?session_key=latest"
const OUT_DIR = "public/headshots"
const force = process.argv.includes("--force")

/** TLA → playerId from the latest committed drivers snapshot. */
async function tlaToPlayerId(): Promise<Map<string, string>> {
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
    parsed.data.filter((a) => a.kind === "driver").map((a) => [a.tla.toUpperCase(), a.playerId])
  )
}

type OpenF1Driver = {
  name_acronym?: string
  headshot_url?: string | null
  driver_number?: number | null
}

/**
 * OpenF1's headshot_url points at the F1 media CDN's `1col` render (93×93),
 * too small for the driver hero. The CDN serves the same transparent cutout at
 * other widths by swapping the transform segment; `4col` is 432×432 (~55KB).
 */
const HEADSHOT_RENDER = "4col"

function heroRender(url: string): string {
  return url.replace(/\.transform\/\d+col\//, `.transform/${HEADSHOT_RENDER}/`)
}

const byTla = await tlaToPlayerId()
console.log(`· ${byTla.size} drivers in the latest snapshot`)

const res = await fetch(OPENF1_DRIVERS).catch(() => null)
if (!res || !res.ok) {
  console.log(
    `· OpenF1 unavailable (HTTP ${res?.status ?? "network error"}) — ` +
      "likely a live-session restriction; rerun later. Monogram fallbacks cover missing files."
  )
  process.exit(0)
}

const payload: unknown = await res.json().catch(() => null)
if (!Array.isArray(payload)) {
  console.log("· OpenF1 returned a non-list payload — rerun later.")
  process.exit(0)
}

await mkdir(OUT_DIR, { recursive: true })
const manifest: Record<string, { file: string; tla: string; number: number | null }> = {}
let downloaded = 0
let kept = 0

for (const entry of payload as OpenF1Driver[]) {
  const tla = entry.name_acronym?.toUpperCase()
  const url = entry.headshot_url
  if (!tla || !url) continue
  const playerId = byTla.get(tla)
  if (!playerId) {
    console.log(`· ${tla}: no matching driver in the fantasy feed — skipped`)
    continue
  }

  const ext = new URL(url).pathname.match(/\.(png|webp|jpe?g|avif)$/i)?.[1]
  const file = `${playerId}.${(ext ?? "png").toLowerCase()}`
  manifest[playerId] = { file, tla, number: entry.driver_number ?? null }

  const target = `${OUT_DIR}/${file}`
  if (existsSync(target) && !force) {
    kept += 1
    continue
  }
  const img = await fetch(heroRender(url)).catch(() => null)
  if (!img || !img.ok) {
    console.log(`· ${tla}: headshot download failed — monogram fallback`)
    delete manifest[playerId]
    continue
  }
  await writeFile(target, Buffer.from(await img.arrayBuffer()))
  downloaded += 1
  console.log(`✓ ${target}`)
}

await writeFile(
  `${OUT_DIR}/manifest.json`,
  `${JSON.stringify(
    {
      attribution: "Driver imagery via OpenF1 (CC BY-NC-SA)",
      byPlayerId: manifest,
    },
    null,
    2
  )}\n`
)
console.log(
  `✓ ${OUT_DIR}/manifest.json — ${downloaded} downloaded, ${kept} kept, ${
    Object.keys(manifest).length
  } total`
)
