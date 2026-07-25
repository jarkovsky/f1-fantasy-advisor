import { readdirSync } from "node:fs"

import { describe, expect, it } from "vitest"

import manifest from "@/data/manifest.json"
import {
  DRIVERS_RAW,
  snapshotConstraints,
  snapshotDrivers,
  snapshotRaceday,
} from "./snapshot-data"
import { parseConstraints, parseDriversFeed, parseRaceday } from "./schemas"

describe("snapshot-data ↔ data/ drift", () => {
  it("every committed data/drivers/*.json has a DRIVERS_RAW import", () => {
    const onDisk = readdirSync("data/drivers")
      .filter((f) => f.endsWith(".json"))
      .map((f) => Number(f.replace(".json", "")))
      .sort((a, b) => a - b)
    const imported = Object.keys(DRIVERS_RAW)
      .map(Number)
      .sort((a, b) => a - b)
    // Fails when `pnpm snapshot` captured a new race that wasn't added to the
    // static import map in snapshot-data.ts.
    expect(imported).toEqual(onDisk)
  })

  it("every snapshot has a manifest entry", () => {
    const keys = Object.keys(manifest)
    for (const race of Object.keys(DRIVERS_RAW)) {
      expect(keys).toContain(`drivers/${race}.json`)
    }
    expect(keys).toContain("constraints.json")
    expect(keys).toContain("raceday.json")
  })
})

describe("snapshots parse through the real boundary", () => {
  it("drivers snapshots parse (33 assets: 22 drivers + 11 constructors)", () => {
    for (const race of Object.keys(DRIVERS_RAW).map(Number)) {
      const snap = snapshotDrivers(race)
      expect(snap).not.toBeNull()
      const res = parseDriversFeed(snap?.raw)
      expect(res.ok).toBe(true)
      if (!res.ok) continue
      expect(res.data).toHaveLength(33)
      expect(res.data.filter((a) => a.kind === "driver")).toHaveLength(22)
      expect(res.data.filter((a) => a.kind === "constructor")).toHaveLength(11)
      expect(res.dropped).toBe(0)
      // PlayerId is the unique key
      expect(new Set(res.data.map((a) => a.playerId)).size).toBe(33)
    }
  })

  it("unknown race → null, not a crash", () => {
    expect(snapshotDrivers(99)).toBeNull()
  })

  it("constraints + raceday snapshots parse with provenance", () => {
    const c = snapshotConstraints()
    expect(parseConstraints(c.raw).ok).toBe(true)
    expect(c.asOf).not.toBe("")
    const r = snapshotRaceday()
    const parsed = parseRaceday(r.raw)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.length).toBeGreaterThanOrEqual(22)
  })
})
