/**
 * zod boundary for the official F1 Fantasy feeds: untrusted raw JSON in,
 * clean typed domain models out.
 *
 * The raw schemas preserve the feed's verbatim quirks (typo'd field names like
 * `FUllName`, "gameday" vocabulary like `GamedayId`/`GamedayPoints`, mixed
 * string/number typing, `''`-as-null, `'0'` vs `'11.00'` points formats) and
 * normalize them in one place — domain models use OUR race terminology.
 * Domain types are inferred with `z.infer` — single source of truth.
 *
 * Every public `parseX` function returns a Result and NEVER throws: a
 * malformed payload must degrade (to a snapshot) rather than crash a page or
 * abort the build.
 */
import * as z from "zod"

import { SESSION_LABELS } from "./config"

export type ParseResult<T> =
  | { ok: true; data: T; dropped?: number }
  | { ok: false; summary: string[] }

function summarize(error: z.ZodError): string[] {
  return error.issues.map(
    (i) => `${i.path.join(".") || "<root>"}: ${i.code} (${i.message})`
  )
}

// ---------------------------------------------------------------------------
// Shared coercion helpers (the feed's stringly-typed numerics)
// ---------------------------------------------------------------------------

/**
 * `'26.5' | 26.5` → 265 integer tenths-of-a-million.
 * `Math.round` guards float drift (28.9 * 10 can be 288.999…).
 */
const moneyTenths = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const n = Number(v)
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "non-numeric money value" })
      return z.NEVER
    }
    return Math.round(n * 10)
  })
  .pipe(z.int())

/** `''` → null, else the trimmed string (constructor-empty fields). */
const emptyToNull = z.string().transform((s) => {
  const t = s.trim()
  return t === "" ? null : t
})

/**
 * Points strings are format-inconsistent: `'11.00'`, `'-8.00'`, `'0'`
 * (pre-race), or `''` (pre-race / non-sprint). → number | null.
 */
const pointsNullable = z.union([z.string(), z.number()]).transform((v, ctx) => {
  if (v === "") return null
  const n = Number(v)
  if (Number.isNaN(n)) {
    ctx.addIssue({ code: "custom", message: "non-numeric points value" })
    return z.NEVER
  }
  return n
})

/** Int-as-string (`'13'`) → 13. */
const intString = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = Number(v)
  if (!Number.isInteger(n)) {
    ctx.addIssue({ code: "custom", message: "expected an integer" })
    return z.NEVER
  }
  return n
})

/** Offset-aware ISO8601 string → epoch ms. The feed's only reliable timestamps. */
const isoToEpochMs = z.string().transform((s, ctx) => {
  const ms = Date.parse(s)
  if (Number.isNaN(ms)) {
    ctx.addIssue({ code: "custom", message: `unparseable ISO date: ${s}` })
    return z.NEVER
  }
  return ms
})

// ---------------------------------------------------------------------------
// Feed envelope
// ---------------------------------------------------------------------------

const FeedMeta = z.object({
  Success: z.boolean(),
  StatusCode: z.number().int(),
})

// ---------------------------------------------------------------------------
// Drivers feed: sessions, stats, assets
// ---------------------------------------------------------------------------

/**
 * The complete label set. `.catch("Race")` degrades an unknown future label
 * instead of rejecting the asset. Note: there is no distinct "Sprint" label —
 * sprint weekends add a third "Sprint Qualifying" session.
 */
export const SessionLabel = z.enum(SESSION_LABELS).catch("Race")
export type SessionLabelType = z.infer<typeof SessionLabel>

const RawSessionPoints = z
  .object({
    sessionnumber: z.number().int(),
    sessiontype: SessionLabel,
    // int | null (null pre-race) — never float; fractions live in AdditionalStats
    points: z.number().int().nullable(),
    nonegative_points: z.number().int().nullable(),
  })
  .transform((r) => ({
    session: r.sessiontype,
    sessionNumber: r.sessionnumber,
    points: r.points,
    noNegativePoints: r.nonegative_points,
  }))

export type SessionPoints = z.infer<typeof RawSessionPoints>

/**
 * Season-to-date stat breakdown. CAUTION: like the feed's season totals,
 * these values are cumulative *as of feed generation time* — old race files
 * get regenerated, so this is a "latest snapshot", never a per-race series.
 */
const AdditionalStats = z
  .object({
    fastest_lap_pts: z.number(),
    dotd_pts: z.number(),
    overtaking_pts: z.number(),
    q3_finishes_pts: z.number(),
    top10_race_position_pts: z.number(),
    top8_sprint_position_pts: z.number(),
    total_position_pts: z.number(),
    total_position_gained_lost: z.number(),
    total_dnf_dq_pts: z.number(),
    value_for_money: z.number(),
  })
  .transform((r) => ({
    fastestLapPts: r.fastest_lap_pts,
    dotdPts: r.dotd_pts,
    overtakingPts: r.overtaking_pts,
    q3FinishesPts: r.q3_finishes_pts,
    top10RacePositionPts: r.top10_race_position_pts,
    top8SprintPositionPts: r.top8_sprint_position_pts,
    totalPositionPts: r.total_position_pts,
    totalPositionGainedLost: r.total_position_gained_lost,
    totalDnfDqPts: r.total_dnf_dq_pts,
    valueForMoney: r.value_for_money,
  }))

export type AssetAdditionalStats = z.infer<typeof AdditionalStats>

/**
 * One asset row, verbatim raw names (typos included) → clean discriminated
 * union on `kind`. Lean: we model the ~15 fields we consume; `z.object`
 * default-strips the rest (`OverallPpints` is deliberately NOT modeled — it is
 * contaminated; cumulative points are recomputed in history.ts).
 */
export const AssetSchema = z
  .object({
    PlayerId: z.string().min(1), // THE unique key (F1PlayerId is NOT unique)
    Skill: z.number().int(), // 1 = driver, 2 = constructor
    PositionName: z.string(), // 'DRIVER' | 'CONSTRUCTOR' (cross-check)
    Value: moneyTenths, // price as of this race
    OldPlayerValue: moneyTenths, // price at the previous race
    TeamId: z.string(), // driver → constructor PlayerId link
    FUllName: z.string(), // [feed typo]
    DisplayName: z.string(),
    DriverTLA: z.string(),
    TeamName: emptyToNull, // '' for constructors
    CountryName: emptyToNull, // '' for constructors
    SelectedPercentage: intString,
    CaptainSelectedPercentage: intString,
    GamedayPoints: pointsNullable, // feed name; '0' pre-race, '11.00' scored
    NoNegativePoints: pointsNullable, // '' pre-race
    SessionWisePoints: z.array(RawSessionPoints),
    AdditionalStats: AdditionalStats,
  })
  .transform((r, ctx) => {
    // Defense-in-depth: Skill and PositionName must agree.
    const expected =
      r.Skill === 1 ? "DRIVER" : r.Skill === 2 ? "CONSTRUCTOR" : null
    if (expected === null || r.PositionName.toUpperCase() !== expected) {
      ctx.addIssue({
        code: "custom",
        message: `Skill ${r.Skill} contradicts PositionName ${r.PositionName}`,
      })
      return z.NEVER
    }

    // Pre-race: all session points are null → the race week is pending and
    // the top-level '0' is a placeholder, not a score.
    const pending = r.SessionWisePoints.every((s) => s.points === null)

    const common = {
      playerId: r.PlayerId,
      displayName: r.DisplayName,
      fullName: r.FUllName,
      tla: r.DriverTLA,
      priceTenths: r.Value,
      prevPriceTenths: r.OldPlayerValue,
      selectedPercent: r.SelectedPercentage,
      captainSelectedPercent: r.CaptainSelectedPercentage,
      /** Whole-race-weekend fantasy points (feed: GamedayPoints). */
      racePoints: pending ? null : r.GamedayPoints,
      noNegativePoints: pending ? null : r.NoNegativePoints,
      sessionPoints: r.SessionWisePoints,
      additionalStats: r.AdditionalStats,
    }

    return r.Skill === 1
      ? {
          kind: "driver" as const,
          ...common,
          constructorId: r.TeamId,
          teamName: r.TeamName,
          countryName: r.CountryName,
        }
      : {
          kind: "constructor" as const,
          ...common,
          teamName: r.FUllName,
        }
  })

export type Asset = z.infer<typeof AssetSchema>
export type Driver = Extract<Asset, { kind: "driver" }>
export type Constructor = Extract<Asset, { kind: "constructor" }>

const DriversFeedEnvelope = z.object({
  Data: z.object({ Value: z.array(z.unknown()) }),
  Meta: FeedMeta,
})

/**
 * Parse one race's drivers payload. Per-element drop: one corrupt asset is
 * dropped (and counted) rather than failing all 33.
 */
export function parseDriversFeed(raw: unknown): ParseResult<Asset[]> {
  const envelope = DriversFeedEnvelope.safeParse(raw)
  if (!envelope.success)
    return { ok: false, summary: summarize(envelope.error) }
  if (!envelope.data.Meta.Success || envelope.data.Meta.StatusCode !== 200) {
    return { ok: false, summary: ["feed Meta indicates failure"] }
  }

  const assets: Asset[] = []
  let dropped = 0
  for (const rawAsset of envelope.data.Data.Value) {
    const res = AssetSchema.safeParse(rawAsset)
    if (res.success) assets.push(res.data)
    else dropped += 1
  }
  if (assets.length === 0) {
    return { ok: false, summary: ["every asset row failed to parse"] }
  }
  return { ok: true, data: assets, dropped }
}

// ---------------------------------------------------------------------------
// constraints.json
// ---------------------------------------------------------------------------

const RawConstraints = z
  .object({
    GamedayId: z.number().int(), // feed name for the CURRENT race pointer
    LPTourGamedayId: z.number().int(), // last COMPLETED race
    TREndGamedayId: z.number().int(), // season end (22)
    MaxTeamValue: z.number(),
    ARRGamedayId: z.array(z.number().int()),
    GMCSubScenario: z.string(),
    // Verified stale/wrong (read "06/05/2026 00:00:00" while the real Monaco
    // lock was June 6). Carried for debugging only — NEVER drive LOCKED off
    // this; the lock comes from raceday's first-session ISO8601 (raceweek.ts).
    DeadlineDate: z.string(),
  })
  .transform((r) => ({
    raceNumber: r.GamedayId,
    lastCompletedRace: r.LPTourGamedayId,
    seasonEndRace: r.TREndGamedayId,
    budgetCapTenths: Math.round(r.MaxTeamValue * 10),
    rolloverArmedRaces: r.ARRGamedayId,
    subScenario: r.GMCSubScenario,
    advisoryDeadlineRaw: r.DeadlineDate,
  }))

export type RaceWeekConstraints = z.infer<typeof RawConstraints>

const ConstraintsEnvelope = z.object({
  Data: z.object({ Value: RawConstraints }),
  Meta: FeedMeta,
})

export function parseConstraints(
  raw: unknown
): ParseResult<RaceWeekConstraints> {
  const res = ConstraintsEnvelope.safeParse(raw)
  if (!res.success) return { ok: false, summary: summarize(res.error) }
  return { ok: true, data: res.data.Data.Value }
}

// ---------------------------------------------------------------------------
// raceday_en.json — flat session rows → grouped RaceWeekend[]
// ---------------------------------------------------------------------------

const RawSessionRow = z
  .object({
    GamedayId: z.number().int(), // feed name for the race number
    GDStatus: z.number().int(), // 0 upcoming | 1 current | 4 completed
    SessionType: SessionLabel,
    // ONLY the ISO8601 fields are reliable (offset-aware). The naive
    // SessionStartDate is UTC MM/DD/YYYY and GMTOffset is always ''.
    SessionStartDateISO8601: isoToEpochMs,
    SessionEndDateISO8601: isoToEpochMs,
    MeetingName: z.string(),
    CircuitLocation: z.string(),
  })
  .transform((r) => ({
    raceNumber: r.GamedayId,
    status: r.GDStatus,
    session: r.SessionType,
    startsAtMs: r.SessionStartDateISO8601,
    endsAtMs: r.SessionEndDateISO8601,
    gpName: r.MeetingName,
    circuitLocation: r.CircuitLocation,
  }))

export type RaceSession = {
  session: SessionLabelType
  startsAtMs: number
  endsAtMs: number
}

export type RaceWeekend = {
  raceNumber: number
  /** RACE_STATUS values (mirrors the feed's GDStatus). */
  status: number
  gpName: string
  circuitLocation: string
  isSprint: boolean
  sessions: RaceSession[]
  /** First session start = the team lock (the REAL deadline). */
  lockAtMs: number
  /** Last session end ≈ when the race weekend is over. */
  raceEndsApproxMs: number
}

const RacedayEnvelope = z.object({
  Data: z.object({ Value: z.array(RawSessionRow) }),
  Meta: FeedMeta,
})

export function parseRaceday(raw: unknown): ParseResult<RaceWeekend[]> {
  const res = RacedayEnvelope.safeParse(raw)
  if (!res.success) return { ok: false, summary: summarize(res.error) }

  const byRace = new Map<number, z.infer<typeof RawSessionRow>[]>()
  for (const row of res.data.Data.Value) {
    const rows = byRace.get(row.raceNumber)
    if (rows) rows.push(row)
    else byRace.set(row.raceNumber, [row])
  }

  const weekends: RaceWeekend[] = []
  for (const [raceNumber, rows] of byRace) {
    const sessions = rows
      .map((r) => ({
        session: r.session,
        startsAtMs: r.startsAtMs,
        endsAtMs: r.endsAtMs,
      }))
      .sort((a, b) => a.startsAtMs - b.startsAtMs)
    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    const meta = rows[0]
    if (!first || !last || !meta) continue // defensive: empty race group
    weekends.push({
      raceNumber,
      status: meta.status,
      gpName: meta.gpName,
      circuitLocation: meta.circuitLocation,
      isSprint: sessions.some((s) => s.session === "Sprint Qualifying"),
      sessions,
      lockAtMs: first.startsAtMs,
      raceEndsApproxMs: last.endsAtMs,
    })
  }
  weekends.sort((a, b) => a.raceNumber - b.raceNumber)
  return { ok: true, data: weekends }
}

// ---------------------------------------------------------------------------
// live/mixapi.json — cheap change detector + live flag
// ---------------------------------------------------------------------------

const MixapiEnvelope = z.object({
  Value: z.object({
    isLive: z.union([z.string(), z.number()]).transform((v) => Number(v) === 1),
    Maintenance: z
      .union([z.string(), z.number()])
      .transform((v) => String(v) !== "0" && String(v) !== ""),
    feedBuster: z.object({
      fixtures: z.string(),
      config: z.string(),
      statistics: z.string(),
    }),
  }),
})

export type Mixapi = {
  isLive: boolean
  maintenance: boolean
  feedVersions: { fixtures: string; config: string; statistics: string }
}

export function parseMixapi(raw: unknown): ParseResult<Mixapi> {
  const res = MixapiEnvelope.safeParse(raw)
  if (!res.success) return { ok: false, summary: summarize(res.error) }
  const v = res.data.Value
  return {
    ok: true,
    data: {
      isLive: v.isLive,
      maintenance: v.Maintenance,
      feedVersions: v.feedBuster,
    },
  }
}
