"use client"

import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"

import { useEffect, useRef, useState, useTransition } from "react"

import { reconcileLineup, toOptimizerAssets } from "@/lib/optimizer/adapter"

// Type-only: the module itself is imported dynamically so the 1.45M-combination
// search stays out of the island's first-load bundle.
type OptimizerModule = typeof import("@/lib/optimizer/optimize")

/**
 * Runs the transfer optimizer for the current team + projections, lazily
 * importing the module on mount and recomputing (transition-wrapped, with
 * cancel guards) whenever the inputs change. Returns the plan, the keep-current
 * baseline, unresolved lineup ids, an error string, the pending flag, and a
 * polite status message.
 */
export function useOptimizer(input: {
  assets: AssetLite[]
  totals: Record<string, number>
  lineup: string[] | null
  remainingCostCapTenths: number
  freeTransfers: 2 | 3 | "unlimited"
  whatIf: WhatIfMode
}): {
  result: OptimizerResult | null
  baseline: TeamPlan | null
  unresolvedIds: string[]
  error: string | null
  isPending: boolean
  statusMessage: string
} {
  const { assets, totals, lineup, remainingCostCapTenths, freeTransfers, whatIf } = input

  const optimizerRef = useRef<OptimizerModule | null>(null)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [baseline, setBaseline] = useState<TeamPlan | null>(null)
  const [unresolvedIds, setUnresolvedIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState("")

  // Warm the optimizer chunk on mount, even before there is a lineup to optimize.
  useEffect(() => {
    if (optimizerRef.current) return
    let cancelled = false
    void import("@/lib/optimizer/optimize").then((mod) => {
      if (!cancelled) optimizerRef.current = mod
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!lineup) return
    let cancelled = false

    void (async () => {
      const mod = optimizerRef.current ?? (await import("@/lib/optimizer/optimize"))
      optimizerRef.current = mod
      if (cancelled) return

      const grid = toOptimizerAssets(assets, totals)
      const { assets: reconciled, unresolvedIds: missing } = reconcileLineup(lineup, grid)
      const optInput = {
        assets: reconciled,
        lineup,
        remainingCostCapTenths,
        freeTransfers: whatIf !== "none" ? ("unlimited" as const) : freeTransfers,
        mode: whatIf === "none" ? ("normal" as const) : whatIf,
      }

      try {
        const optimized = mod.optimize(optInput)
        // Baseline = keeping the current team: a 0-transfer plan if one exists.
        const keep = optimized.byTransferCount[0] ?? null
        if (cancelled) return
        startTransition(() => {
          setResult(optimized)
          setBaseline(keep)
          setUnresolvedIds(missing)
          setError(null)
          const { transfers, score } = optimized.best
          setStatusMessage(
            `Updated — ${transfers} transfer${transfers === 1 ? "" : "s"}, ${score.toFixed(1)} points.`
          )
        })
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof mod.OptimizerInputError
            ? err.message
            : "Could not compute a recommendation."
        startTransition(() => {
          setResult(null)
          setError(message)
          setStatusMessage(message)
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [totals, lineup, remainingCostCapTenths, freeTransfers, whatIf, assets])

  return {
    result,
    baseline,
    unresolvedIds,
    error,
    isPending,
    statusMessage: isPending ? "Recomputing recommendation…" : statusMessage,
  }
}
