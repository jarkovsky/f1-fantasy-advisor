import type { TeamPlan } from "@/lib/optimizer/types/optimizer"

/** One out→in pairing from the symmetric diff (either side may be null). */
export type Swap = { outId: string | null; inId: string | null }

/** A recommended-squad slot: an incoming id, with the out it replaced (or null when kept). */
export type SlotRow = { inId: string; outId: string | null }

/** Symmetric set diff between the current roster and the plan, by class. */
export function diffSquad(
  baseline: TeamPlan | null,
  plan: TeamPlan
): { drivers: Swap[]; constructors: Swap[] } {
  const pair = (current: string[], next: string[]): Swap[] => {
    const outs = current.filter((id) => !next.includes(id))
    const ins = next.filter((id) => !current.includes(id))
    const rows: Swap[] = []
    const len = Math.max(outs.length, ins.length)
    for (let i = 0; i < len; i++) {
      rows.push({ outId: outs[i] ?? null, inId: ins[i] ?? null })
    }
    return rows
  }
  return {
    drivers: pair(baseline?.driverIds ?? [], plan.driverIds),
    constructors: pair(baseline?.constructorIds ?? [], plan.constructorIds),
  }
}

/**
 * Recommended-squad rows, by class. A slot is a "kept" row when its in-asset is
 * also in the baseline (no swap); otherwise it carries the matching out→in swap
 * so the same row shows both the departing and arriving asset. When there is no
 * baseline (no valid current team) every plan id is a plain kept-style row.
 */
export function slotRows(
  baseline: TeamPlan | null,
  plan: TeamPlan,
  swaps: { drivers: Swap[]; constructors: Swap[] }
): { drivers: SlotRow[]; constructors: SlotRow[] } {
  const build = (
    planIds: string[],
    baselineIds: string[] | undefined,
    classSwaps: Swap[]
  ): SlotRow[] => {
    // Incoming ids (in the plan, not in the baseline), each paired with the
    // matching outgoing id from the symmetric diff so the row can render out→in.
    const incoming = baselineIds ? planIds.filter((id) => !baselineIds.includes(id)) : []
    const outsForIn = new Map<string, string | null>()
    for (const s of classSwaps) {
      if (s.inId !== null) outsForIn.set(s.inId, s.outId)
    }
    return planIds.map((id) => ({
      inId: id,
      outId: incoming.includes(id) ? (outsForIn.get(id) ?? null) : null,
    }))
  }
  return {
    drivers: build(plan.driverIds, baseline?.driverIds, swaps.drivers),
    constructors: build(plan.constructorIds, baseline?.constructorIds, swaps.constructors),
  }
}
