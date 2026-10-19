/**
 * The client preference plane: the user's team, persisted to localStorage and
 * surfaced to React islands via useSyncExternalStore.
 *
 * This is the app's only persisted client state. The data layer (lib/f1/*) is
 * the read-only server plane; this module is the read-write client plane. It is
 * deliberately dumb persistence: team rules belong to the picker. The only
 * validation is a shape guard on what we read back — anything we didn't write
 * is treated as corrupt and replaced with DEFAULT_STATE.
 *
 * Three contracts make useSyncExternalStore safe:
 * 1. getSnapshot() is reference-stable between mutations. React compares with
 *    Object.is; a fresh object per call would loop forever. We hand back a
 *    cached object and only swap the reference on an actual mutation.
 * 2. getServerSnapshot() and the first client getSnapshot() are both
 *    DEFAULT_STATE, so the server render and the first client render agree (no
 *    hydration mismatch). localStorage is read lazily on first subscribe, never
 *    inside getSnapshot — a synchronous read there would diverge from the
 *    server HTML.
 * 3. `hydrated` is its own subscription (false on the server and the first
 *    client render), so an island can hold a skeleton until the first
 *    localStorage read lands — even when that read leaves the snapshot as-is.
 *
 * No wall-clock reads anywhere — the race-week machine (lib/f1/raceweek.ts)
 * owns time; this module only stores the raceNumber a team was entered for.
 *
 * Persistence degrades silently: a blocked, full, or throwing localStorage
 * (e.g. Safari private mode) still yields a working in-memory session. The key
 * is versioned ("f1:v2") so a future shape can migrate rather than crash; a
 * v1 save under "f1:v1" is read once, migrated, and replaced on the next write.
 */
import type { TeamStateV2 } from "./types/team-state"

import { useSyncExternalStore } from "react"

import { INITIAL_COST_CAP_TENTHS, TEAM_CONSTRUCTORS, TEAM_DRIVERS } from "@/lib/constants"

type FreeTransfers = TeamStateV2["freeTransfers"]
type Chip = TeamStateV2["activeChip"]

const STORAGE_KEY = "f1:v2"
/** v1 saves, written before the official-vocabulary renames (v1 → v2 below). */
const LEGACY_STORAGE_KEY = "f1:v1"

/**
 * The pristine first-visit state. Frozen and shared by reference: it is the
 * server snapshot and the pre-hydration client snapshot, so both renders match.
 */
export const DEFAULT_STATE: TeamStateV2 = Object.freeze({
  v: 2,
  lineup: null,
  remainingCostCapTenths: INITIAL_COST_CAP_TENTHS,
  freeTransfers: "unlimited",
  raceNumber: null,
  activeChip: "none",
  savedProjection: null,
})

// ---------------------------------------------------------------------------
// Module cache — the single source of the current snapshot reference.
// `cache` is what getSnapshot() returns; it is replaced only when the state
// changes (a mutation, hydration, or a cross-tab write).
// ---------------------------------------------------------------------------

let cache: TeamStateV2 = DEFAULT_STATE
let hydrated = false

const listeners = new Set<() => void>()

// One window "storage" listener, shared by all subscribers (cross-tab sync).
// Installed on the first subscribe, removed when the last unsubscribes.
let storageHandler: ((e: StorageEvent) => void) | null = null

function emit(): void {
  for (const cb of listeners) cb()
}

// ---------------------------------------------------------------------------
// Shape guards — anything we didn't write back is corrupt → DEFAULT_STATE.
// ---------------------------------------------------------------------------

function isLineup(value: unknown): value is string[] | null {
  if (value === null) return true
  return (
    Array.isArray(value) &&
    value.length === TEAM_DRIVERS + TEAM_CONSTRUCTORS &&
    value.every((id) => typeof id === "string")
  )
}

function isFreeTransfers(value: unknown): value is FreeTransfers {
  return value === 2 || value === 3 || value === "unlimited"
}

function isChip(value: unknown): value is Chip {
  return value === "none" || value === "wildcard" || value === "limitless"
}

function isSavedProjection(value: unknown): value is TeamStateV2["savedProjection"] {
  if (value === null) return true
  if (typeof value !== "object") return false
  const p = value as Record<string, unknown>
  return typeof p.totalPoints === "number" && typeof p.preset === "string"
}

/**
 * Full shape-guard of a parsed v2 payload. Any miss → DEFAULT_STATE. Keys it
 * doesn't know are dropped, so saves from older builds (which also stored a
 * `dismissedHonestyNote` flag) still load.
 */
function validateV2(parsed: Record<string, unknown>): TeamStateV2 {
  if (
    isLineup(parsed.lineup) &&
    Number.isInteger(parsed.remainingCostCapTenths) &&
    isFreeTransfers(parsed.freeTransfers) &&
    (parsed.raceNumber === null || Number.isInteger(parsed.raceNumber)) &&
    isChip(parsed.activeChip) &&
    isSavedProjection(parsed.savedProjection)
  ) {
    return {
      v: 2,
      lineup: parsed.lineup,
      remainingCostCapTenths: parsed.remainingCostCapTenths as number,
      freeTransfers: parsed.freeTransfers,
      raceNumber: parsed.raceNumber as number | null,
      activeChip: parsed.activeChip,
      savedProjection: parsed.savedProjection,
    }
  }
  return DEFAULT_STATE
}

/**
 * v2 → validate. v1 differs only in two field names, the stored pre-rename
 * vocabulary (`roster` = lineup, `budgetTenths` = Remaining Cost Cap), so it
 * is renamed forward and validated as v2. Any other/missing version →
 * DEFAULT_STATE.
 */
function migrate(parsed: unknown): TeamStateV2 {
  if (parsed === null || typeof parsed !== "object") return DEFAULT_STATE
  const record = parsed as Record<string, unknown>
  if (record.v === 2) return validateV2(record)
  if (record.v === 1) {
    const { roster, budgetTenths, ...rest } = record
    return validateV2({ ...rest, lineup: roster, remainingCostCapTenths: budgetTenths })
  }
  return DEFAULT_STATE
}

/**
 * SSR-safe localStorage read. Corrupt JSON, blocked storage, or any throw →
 * DEFAULT_STATE. Never throws: a failed read must not crash the island.
 */
function load(): TeamStateV2 {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw === null) return DEFAULT_STATE
    return migrate(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

/** Best-effort persist; failures (private mode, full quota) are swallowed. */
function persist(state: TeamStateV2): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    // The v2 write supersedes any v1 save it was migrated from.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // The in-memory cache stays authoritative for this session.
  }
}

// ---------------------------------------------------------------------------
// Snapshot and subscription
// ---------------------------------------------------------------------------

function commit(next: TeamStateV2): void {
  cache = next
  persist(next)
  emit()
}

function getSnapshot(): TeamStateV2 {
  return cache
}

function getServerSnapshot(): TeamStateV2 {
  return DEFAULT_STATE
}

function getHydrated(): boolean {
  return hydrated
}

function getServerHydrated(): boolean {
  return false
}

function hydrate(): void {
  hydrated = true
  cache = load()
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)

  // Lazy hydration on the first subscriber: read localStorage once, swap the
  // cache, and notify. Doing this here (not in getSnapshot) keeps the server
  // and first-client renders identical.
  if (!hydrated) hydrate()

  // Install the single cross-tab listener on the first subscriber.
  if (storageHandler === null && typeof window !== "undefined") {
    storageHandler = (e: StorageEvent) => {
      // Ignore other keys. key is null when another tab calls clear(), so re-read.
      if (e.key !== null && e.key !== STORAGE_KEY && e.key !== LEGACY_STORAGE_KEY) return
      cache = load()
      emit()
    }
    window.addEventListener("storage", storageHandler)
  }

  return () => {
    listeners.delete(cb)
    // Symmetric teardown (StrictMode double-invoke safe): drop the window
    // listener only when the last subscriber leaves.
    if (listeners.size === 0 && storageHandler !== null && typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler)
      storageHandler = null
    }
  }
}

// ---------------------------------------------------------------------------
// Mutators — plain module functions, so they are referentially stable. Each
// builds the next snapshot from the current cache and commits it (persist +
// notify). The "storage" event never fires in the tab that wrote, so emit() is
// the same-tab notification path.
// ---------------------------------------------------------------------------

function setTeam(
  lineup: string[],
  remainingCostCapTenths: number,
  freeTransfers: FreeTransfers,
  raceNumber: number
): void {
  commit({ ...cache, lineup, remainingCostCapTenths, freeTransfers, raceNumber })
}

function applyPlan(
  lineup: string[],
  remainingCostCapTenths: number,
  savedProjection?: TeamStateV2["savedProjection"]
): void {
  const next: TeamStateV2 = { ...cache, lineup, remainingCostCapTenths }
  if (savedProjection !== undefined) next.savedProjection = savedProjection
  commit(next)
}

/**
 * Confirm the rollover into the next race week. Bumping raceNumber here is the
 * single mutation that flips the race-week machine from ROLLOVER to OPEN.
 */
function confirmRollover(args: {
  lineup: string[]
  remainingCostCapTenths: number
  freeTransfers: FreeTransfers
  raceNumber: number
  activeChip: Chip
}): void {
  commit({ ...cache, ...args })
}

/** Back to first-visit. Removes the key so a reload re-hydrates DEFAULT. */
function reset(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // ignore — in-memory reset still applies below.
    }
  }
  cache = DEFAULT_STATE
  emit()
}

// ---------------------------------------------------------------------------
// Test seam: drive the store without React, and restore pristine module state.
// ---------------------------------------------------------------------------

/** Restore the module to its just-imported state (for test isolation). */
function __resetForTests(): void {
  cache = DEFAULT_STATE
  hydrated = false
  listeners.clear()
  if (storageHandler !== null && typeof window !== "undefined") {
    window.removeEventListener("storage", storageHandler)
  }
  storageHandler = null
}

export const teamStore = {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  setTeam,
  applyPlan,
  confirmRollover,
  reset,
  __resetForTests,
}

// ---------------------------------------------------------------------------
// React hook — the island-facing API. The mutators are the module functions
// themselves, so they are referentially stable across renders.
// ---------------------------------------------------------------------------

export function useTeamStore(): {
  state: TeamStateV2
  hydrated: boolean
  setTeam: typeof setTeam
  applyPlan: typeof applyPlan
  confirmRollover: typeof confirmRollover
  reset: typeof reset
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // Subscribed separately: hydrating an empty store keeps the DEFAULT_STATE
  // reference, so the snapshot alone would never re-render the island.
  const isHydrated = useSyncExternalStore(subscribe, getHydrated, getServerHydrated)
  return {
    state,
    hydrated: isHydrated,
    setTeam,
    applyPlan,
    confirmRollover,
    reset,
  }
}
