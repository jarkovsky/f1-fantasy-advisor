/**
 * Generates the scattered-dot background SVGs into public/patterns/. Run via
 * `pnpm pattern` (tsx), commit the result.
 *
 * The page background is a paper grey with a faint speckle texture, tiled
 * from one SVG per theme. Dots are placed by a seeded PRNG (mulberry32) so
 * re-runs are byte-identical — the assets are deterministic build inputs, not
 * random output. Never part of `next build`.
 */
import { mkdir, writeFile } from "node:fs/promises"

const OUT_DIR = "public/patterns"
const TILE = 1000
const DOTS = 120
const SEED = 0xf1f1

/** Deterministic 32-bit PRNG — same seed, same speckle, every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tile(fill: "black" | "white"): string {
  const rand = mulberry32(SEED)
  const dots = Array.from({ length: DOTS }, () => {
    const cx = (rand() * TILE).toFixed(2)
    const cy = (rand() * TILE).toFixed(2)
    const r = (1 + rand()).toFixed(2) // 1..2px
    const opacity = (0.25 + rand() * 0.25).toFixed(2) // 0.25..0.5
    return `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}" />`
  })
  return [
    `<svg width="${TILE}" height="${TILE}" xmlns="http://www.w3.org/2000/svg">`,
    `  <rect width="${TILE}" height="${TILE}" fill="transparent" />`,
    ...dots,
    `</svg>`,
    ``,
  ].join("\n")
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(`${OUT_DIR}/dot-pattern-light.svg`, tile("black"))
  await writeFile(`${OUT_DIR}/dot-pattern-dark.svg`, tile("white"))
  console.log(`wrote ${OUT_DIR}/dot-pattern-{light,dark}.svg (seed ${SEED})`)
}

await main()
