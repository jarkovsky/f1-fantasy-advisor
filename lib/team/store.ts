/**
 * The client preference plane: the user's team, persisted to localStorage and
 * surfaced to React islands via useSyncExternalStore.
 *
 * This is the ONLY mutable client state in the app. The data layer (lib/f1/*)
 * is the read-only server plane; this module is the read-write client plane.
 * It is DUMB persistence — squad-shape validation belongs to the picker, not
 * here. We only guard the SHAPE we read back (anything we didn't write is
 * treated as corrupt → DEFAULT_STATE).
 *
 * Three hard contracts make useSyncExternalStore safe:
 * 1. getSnapshot() is reference-stable between mutations. React compares with
 *    Object.is; a fresh object per call would loop forever. We hand back a
 *    cached object and only swap the reference on an actual mutation.
 * 2. getServerSnapshot() === the FIRST client getSnapshot() (both DEFAULT_STATE)
 *    so the server render and the first client render agree (no hydration
 *    mismatch). localStorage is read LAZILY on first subscribe, never inside
 *    getSnapshot — a synchronous read there would diverge from the server HTML.
 * 3. `hydrated` lives in the same snapshot, so an island can re-render from
 *    skeleton to real content the moment the first localStorage read lands.
 *
 * No wall-clock reads anywhere — the race-week machine (lib/f1/raceweek.ts)
 * owns time; this module only stores the raceNumber a team was entered for.
 *
 * Persistence degrades silently: a blocked/quota'd/throwing localStorage still
 * yields a working in-memory session (Safari private mode, full quota). The
 * key is versioned ("f1:v1") so a future shape can migrate rather than crash.
 */
import { useSyncExternalStore } from "react"

import { INITIAL_BUDGET_TENTHS } from "@/lib/constants"

import type { TeamStateV1 } from "./types/team-state"

const STORAGE_KEY = "f1:v1"

/**
 * The pristine first-visit state. Frozen and shared by reference: it is the
 * server snapshot AND the pre-hydration client snapshot, so both renders match.
 */
export const DEFAULT_STATE: TeamStateV1 = Object.freeze({
  v: 1,
  roster: null,
  budgetTenths: INITIAL_BUDGET_TENTHS,
  freeTransfers: "unlimited",
  raceNumber: null,
  activeChip: "none",
  dismissedHonestyNote: false,
  savedProjection: null,
})

// ---------------------------------------------------------------------------
// Module cache — the single source of the current snapshot reference.
// `cache` is what getSnapshot() returns; it changes ONLY on a real mutation.
// `hydrated` is exposed through the snapshot (see snapshot()).
// ---------------------------------------------------------------------------

let cache: TeamStateV1 = DEFAULT_STATE
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

function isRoster(value: unknown): value is string[] | null {
  if (value === null) return true
  return Array.isArray(value) && value.length === 7 && value.every((id) => typeof id === "string")
}

function isFreeTransfers(value: unknown): value is 2 | 3 | "unlimited" {
  return value === 2 || value === 3 || value === "unlimited"
}

function isSavedProjection(value: unknown): value is TeamStateV1["savedProjection"] {
  if (value === null) return true
  if (typeof value !== "object") return false
  const p = value as Record<string, unknown>
  return typeof p.totalPoints === "number" && typeof p.preset === "string"
}

/** Full shape-guard of a parsed v1 payload. Any miss → DEFAULT_STATE. */
function validateV1(parsed: Record<string, unknown>): TeamStateV1 {
  if (
    isRoster(parsed.roster) &&
    Number.isInteger(parsed.budgetTenths) &&
    isFreeTransfers(parsed.freeTransfers) &&
    (parsed.raceNumber === null || Number.isInteger(parsed.raceNumber)) &&
    (parsed.activeChip === "none" ||
      parsed.activeChip === "wildcard" ||
      parsed.activeChip === "limitless") &&
    typeof parsed.dismissedHonestyNote === "boolean" &&
    isSavedProjection(parsed.savedProjection)
  ) {
    return {
      v: 1,
      roster: parsed.roster,
      budgetTenths: parsed.budgetTenths as number,
      freeTransfers: parsed.freeTransfers,
      raceNumber: parsed.raceNumber as number | null,
      activeChip: parsed.activeChip,
      dismissedHonestyNote: parsed.dismissedHonestyNote,
      savedProjection: parsed.savedProjection,
    }
  }
  return DEFAULT_STATE
}

/** v===1 → validate; any other/missing version → DEFAULT_STATE. */
function migrate(parsed: unknown): TeamStateV1 {
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    (parsed as Record<string, unknown>).v === 1
  ) {
    return validateV1(parsed as Record<string, unknown>)
  }
  return DEFAULT_STATE
}

/**
 * SSR-safe localStorage read. Corrupt JSON, blocked storage, or any throw →
 * DEFAULT_STATE. NEVER throws (a crashed read must not crash the island).
 */
function load(): TeamStateV1 {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_STATE
    return migrate(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

/**
 * Best-effort persist. Failure (Safari private mode, quota) is swallowed: the
 * in-memory cache is the source of truth for the session; persistence degrades.
 */
function persist(state: TeamStateV1): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence silently degrades; the session still works in memory.
  }
}

// ---------------------------------------------------------------------------
// Snapshot — reference-stable, with `hydrated` folded in. The cached object is
// returned as-is; we only build a fresh one when something changed.
// ---------------------------------------------------------------------------

function commit(next: TeamStateV1, write: boolean): void {
  cache = next
  if (write) persist(next)
  emit()
}

function getSnapshot(): TeamStateV1 {
  return cache
}

function getServerSnapshot(): TeamStateV1 {
  return DEFAULT_STATE
}

function hydrate(): void {
  const loaded = load()
  hydrated = true
  // Swap the reference even when the value equals DEFAULT_STATE-by-fields:
  // `hydrated` flipped, and islands gating skeletons must re-render.
  cache = loaded
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)

  // Lazy hydration on the FIRST subscriber: read localStorage once, swap the
  // cache, and notify. Doing this here (not in getSnapshot) keeps the server
  // and first-client renders identical.
  if (!hydrated) hydrate()

  // Install the single cross-tab listener on the first subscriber.
  if (storageHandler === null && typeof window !== "undefined") {
    storageHandler = (e: StorageEvent) => {
      // Ignore other keys; storageArea null on a manual clear() — re-read.
      if (e.key !== null && e.key !== STORAGE_KEY) return
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
// Mutators — plain module functions. Each builds the next snapshot from the
// current cache, commits it (writes + notifies), and is referentially stable.
// Same-tab writes notify via emit(); the "storage" event does NOT fire in the
// originating tab, so the internal emit is the same-tab path.
// ---------------------------------------------------------------------------

function setTeam(
  roster: string[],
  budgetTenths: number,
  freeTransfers: 2 | 3 | "unlimited",
  raceNumber: number
): void {
  commit({ ...cache, roster, budgetTenths, freeTransfers, raceNumber }, true)
}

function setBudget(tenths: number): void {
  commit({ ...cache, budgetTenths: tenths }, true)
}

function setFreeTransfers(ft: 2 | 3 | "unlimited"): void {
  commit({ ...cache, freeTransfers: ft }, true)
}

function applyPlan(
  roster: string[],
  budgetTenths: number,
  savedProjection?: TeamStateV1["savedProjection"]
): void {
  const next: TeamStateV1 = { ...cache, roster, budgetTenths }
  if (savedProjection !== undefined) next.savedProjection = savedProjection
  commit(next, true)
}

/**
 * Confirm the rollover into the next race week. Bumping raceNumber here is the
 * single mutation that flips the race-week machine from ROLLOVER to OPEN.
 */
function confirmRollover(args: {
  roster: string[]
  budgetTenths: number
  freeTransfers: 2 | 3 | "unlimited"
  raceNumber: number
  activeChip: "none" | "wildcard" | "limitless"
}): void {
  commit({ ...cache, ...args }, true)
}

function dismissHonestyNote(): void {
  commit({ ...cache, dismissedHonestyNote: true }, true)
}

/** Back to first-visit. Removes the key so a reload re-hydrates DEFAULT. */
function reset(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
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
  setBudget,
  setFreeTransfers,
  applyPlan,
  confirmRollover,
  dismissHonestyNote,
  reset,
  __resetForTests,
}

// ---------------------------------------------------------------------------
// React hook — the island-facing API. Mutators are spread verbatim from the
// frozen module object, so they are referentially stable across renders.
// ---------------------------------------------------------------------------

export function useTeamStore(): {
  state: TeamStateV1
  hydrated: boolean
  setTeam: typeof setTeam
  setBudget: typeof setBudget
  setFreeTransfers: typeof setFreeTransfers
  applyPlan: typeof applyPlan
  confirmRollover: typeof confirmRollover
  dismissHonestyNote: typeof dismissHonestyNote
  reset: typeof reset
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    state,
    // `hydrated` is module-level (not in the snapshot value object) but the
    // snapshot reference swaps when it flips, so this read is always current.
    hydrated,
    setTeam,
    setBudget,
    setFreeTransfers,
    applyPlan,
    confirmRollover,
    dismissHonestyNote,
    reset,
  }
}
