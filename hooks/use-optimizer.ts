"use client"

import type { OptimizerInputError as OptimizerInputErrorType } from "@/lib/optimizer/optimize"
import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import type { WhatIfMode } from "@/lib/advisor/types/contract"
import type { AssetLite } from "@/lib/asset-lite"

import { useEffect, useRef, useState, useTransition } from "react"

import { reconcileRoster, toOptimizerAssets } from "@/lib/optimizer/adapter"

// Type-only import of the optimizer module for the dynamic import contract; the
// actual value is loaded lazily (no static value import — keeps the 1.45M-combo
// search out of the island's first-load bundle, plan D4).
type OptimizerModule = typeof import("@/lib/optimizer/optimize")

/**
 * Runs the transfer optimizer for the current squad + projections, lazily
 * importing the module on first enable and recomputing (transition-wrapped, with
 * cancel guards) whenever the inputs change. Returns the plan, the keep-current
 * baseline, unresolved roster ids, an error string, the pending flag, and a
 * polite status message.
 */
export function useOptimizer(input: {
  enabled: boolean
  assets: AssetLite[]
  totals: Record<string, number>
  roster: string[] | null
  budgetTenths: number
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
  const { enabled, assets, totals, roster, budgetTenths, freeTransfers, whatIf } = input

  const optimizerRef = useRef<OptimizerModule | null>(null)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [baseline, setBaseline] = useState<TeamPlan | null>(null)
  const [unresolvedIds, setUnresolvedIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startOptTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState("")

  // Kick off the dynamic import on the first enabled render.
  useEffect(() => {
    if (!enabled || optimizerRef.current) return
    let cancelled = false
    void import("@/lib/optimizer/optimize").then((mod) => {
      if (!cancelled) optimizerRef.current = mod
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !roster) return
    let cancelled = false
    setStatusMessage("Recomputing recommendation…")

    void (async () => {
      const mod = optimizerRef.current ?? (await import("@/lib/optimizer/optimize"))
      optimizerRef.current = mod
      if (cancelled) return

      const grid = toOptimizerAssets(assets, totals)
      const { assets: grid2, unresolvedIds: missing } = reconcileRoster(roster, grid)
      const optInput = {
        assets: grid2,
        roster,
        budgetTenths,
        freeTransfers: whatIf !== "none" ? ("unlimited" as const) : freeTransfers,
        mode: whatIf === "none" ? ("normal" as const) : whatIf,
      }

      try {
        const optimized = mod.optimize(optInput)
        // Baseline = keeping the current team: a 0-transfer plan if one exists.
        const keep = optimized.byTransferCount[0] ?? null
        if (cancelled) return
        startOptTransition(() => {
          setResult(optimized)
          setBaseline(keep)
          setUnresolvedIds(missing)
          setError(null)
          setStatusMessage(
            `Updated — ${optimized.best.transfers} transfers, ${optimized.best.score.toFixed(1)} points.`
          )
        })
      } catch (err) {
        if (cancelled) return
        const isInputErr =
          err instanceof (mod.OptimizerInputError as typeof OptimizerInputErrorType)
        startOptTransition(() => {
          setResult(null)
          setError(
            isInputErr && err instanceof Error ? err.message : "Could not compute a recommendation."
          )
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, totals, roster, budgetTenths, freeTransfers, whatIf, assets])

  return { result, baseline, unresolvedIds, error, isPending, statusMessage }
}
