/**
 * Optimizer benchmark. Run via `pnpm bench`.
 *
 * Measures optimize() on deterministic full-size grids (22 drivers / 11
 * constructors ≈ 1.45M candidate squads). Standalone tsx script (not vitest
 * bench): framework-free single-digit-ms measurements, explicit warmup,
 * min/median/p95 reporting, machine info — a copy-paste-ready record for the
 * README. Never exits non-zero: it is a measurement, not a gate.
 */
import type { OptimizerAsset, OptimizerInput } from "@/lib/optimizer/types/optimizer"

import os from "node:os"

import { optimize } from "@/lib/optimizer/optimize"
import { GRID } from "@/lib/constants"

const WARMUP = 50
const MEASURED = 500
const SEEDS = [1, 2, 3]
const MODES = ["normal", "wildcard", "limitless"] as const

function makeInput(seed: number, mode: (typeof MODES)[number]): OptimizerInput {
  // Numerical Recipes LCG: seeded, so every run benchmarks identical grids.
  let state = seed >>> 0
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
  const assets: OptimizerAsset[] = []
  for (let i = 0; i < GRID.drivers; i++) {
    const priceTenths = 38 + Math.round(next() * 270) // $3.8M..$30.8M
    assets.push({
      id: `d${String(i).padStart(2, "0")}`,
      kind: "driver",
      priceTenths,
      projected: priceTenths / 12 + next() * 8,
    })
  }
  for (let i = 0; i < GRID.constructors; i++) {
    const priceTenths = 60 + Math.round(next() * 250)
    assets.push({
      id: `c${String(i).padStart(2, "0")}`,
      kind: "constructor",
      priceTenths,
      projected: priceTenths / 6 + next() * 10,
    })
  }
  return {
    assets,
    roster: ["d00", "d05", "d10", "d15", "d20", "c02", "c07"],
    budgetTenths: 150,
    freeTransfers: 2,
    mode,
  }
}

function quantile(sorted: number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[idx] ?? 0
}

console.log("Optimizer benchmark — C(22,5) × C(11,2) = 1,448,370 candidate squads")
console.log(
  `machine: ${os.cpus()[0]?.model ?? "unknown CPU"} ×${os.cpus().length}, ` +
    `${Math.round(os.totalmem() / 2 ** 30)}GB, node ${process.version}, ${process.platform}/${process.arch}`
)
console.log(`runs: ${WARMUP} warmup + ${MEASURED} measured, seeds ${SEEDS.join("/")}\n`)
console.log("| mode      | min ms | median ms | p95 ms |")
console.log("|-----------|--------|-----------|--------|")

try {
  for (const mode of MODES) {
    const samples: number[] = []
    for (const seed of SEEDS) {
      const input = makeInput(seed, mode)
      for (let i = 0; i < WARMUP; i++) optimize(input)
      for (let i = 0; i < MEASURED; i++) {
        const start = performance.now()
        optimize(input)
        samples.push(performance.now() - start)
      }
    }
    samples.sort((a, b) => a - b)
    const fmt = (x: number) => x.toFixed(3).padStart(6)
    console.log(
      `| ${mode.padEnd(9)} | ${fmt(samples[0] ?? 0)} | ${fmt(quantile(samples, 0.5)).padStart(9)} | ${fmt(quantile(samples, 0.95))} |`
    )
  }
  console.log(`\nrecorded: ${new Date().toISOString()}`)
} catch (err) {
  console.error("benchmark failed:", err)
}
