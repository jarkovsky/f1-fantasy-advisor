import type { TeamPlan } from "@/lib/optimizer/types/optimizer"

/** One out→in pairing from the symmetric diff (either side may be null). */
export type Swap = { outId: string | null; inId: string | null }

/** A recommended-team slot: an incoming id, with the out it replaced (or null when kept). */
export type SlotRow = { inId: string; outId: string | null }

type Compare = (a: string, b: string) => number

/** Symmetric set diff between the current lineup and the plan, by class. */
export function diffTeam(
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
 * The comparison's rows, by class, laid out by the current team so its column
 * never moves when the projection does. The current picks hold the rows in
 * `byCurrent` order (pass a model-independent key, such as price); a kept pick
 * sits beside itself, and the incoming picks fill the leaving picks' rows in
 * `byIncoming` order (best projection first, say). With no baseline (no valid
 * current team) every plan id is a plain kept-style row, in `byIncoming` order.
 */
export function slotRows(
  baseline: TeamPlan | null,
  plan: TeamPlan,
  order: { byCurrent: Compare; byIncoming: Compare }
): { drivers: SlotRow[]; constructors: SlotRow[] } {
  const build = (planIds: string[], baselineIds: string[] | undefined): SlotRow[] => {
    if (!baselineIds) {
      return [...planIds].sort(order.byIncoming).map((id) => ({ inId: id, outId: null }))
    }
    const incoming = planIds.filter((id) => !baselineIds.includes(id)).sort(order.byIncoming)
    const rows: SlotRow[] = []
    for (const id of [...baselineIds].sort(order.byCurrent)) {
      if (planIds.includes(id)) rows.push({ inId: id, outId: null })
      else {
        const inId = incoming.shift()
        if (inId !== undefined) rows.push({ inId, outId: id })
      }
    }
    // A plan larger than the team (never for a 5 + 2 line-up) keeps its extras.
    for (const id of incoming) rows.push({ inId: id, outId: null })
    return rows
  }
  return {
    drivers: build(plan.driverIds, baseline?.driverIds),
    constructors: build(plan.constructorIds, baseline?.constructorIds),
  }
}
