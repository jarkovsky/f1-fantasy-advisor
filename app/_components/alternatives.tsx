"use client"

import { Delta } from "@/app/_components/delta"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { AssetLite } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import type { OptimizerResult, TeamPlan } from "@/lib/optimizer/types/optimizer"
import { PRESET_REGISTRY, type AssetProjection, type ProjectionResult } from "@/lib/projections"

/**
 * "Other transfer counts" — collapsed by default. One row per non-null bucket
 * in byTransferCount, each expandable to show the swap diff and the per-IN-asset
 * projection math (preset label, total, session split, price, equal-PPM note).
 * The footer states the model and sample size.
 */
type AlternativesProps = {
  result: OptimizerResult
  baseline: TeamPlan | null
  assetsById: Record<string, AssetLite>
  projection: ProjectionResult
}

function presetLabel(id: string): string {
  return PRESET_REGISTRY.find((p) => p.id === id)?.label ?? id
}

/** The in-asset projection math block. */
function AssetMath({
  proj,
  asset,
}: {
  proj: AssetProjection | undefined
  asset: AssetLite | undefined
}) {
  if (!proj) return null
  const sessionSplit = proj.perSession
    .map(
      (s) =>
        `${s.session} ${s.expected.toFixed(1)} (n=${s.basisRaces})${s.priorBlended ? " ※" : ""}`
    )
    .join(" · ")

  return (
    <div className="flex flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
      <span>
        {presetLabel(proj.source)}: {proj.totalPoints.toFixed(1)}
      </span>
      {sessionSplit && <span className="font-mono">{sessionSplit}</span>}
      {asset && <span>{formatPriceTenths(asset.priceTenths)}</span>}
      {proj.perSession.some((s) => s.priorBlended) && <span>※ small-sample prior applied</span>}
      {proj.fallback && <span>Equal PPM — no race history yet.</span>}
    </div>
  )
}

export function Alternatives({ result, baseline, assetsById, projection }: AlternativesProps) {
  const baselineTotal = baseline?.projectedTotal ?? 0
  const rows = result.byTransferCount
    .map((plan, t) => ({ plan, t }))
    .filter((r): r is { plan: TeamPlan; t: number } => r.plan !== null)

  const nameOf = (id: string): string => assetsById[id]?.displayName ?? `Asset ${id}`

  const { completedRaces, completedSprints } = projection.basis

  return (
    <Collapsible className="rounded-lg border border-grid-line bg-surface-1">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent-f1">
        <span>Other transfer counts</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ⌄
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-4 pb-4">
        {rows.map(({ plan, t }) => {
          const gain = plan.projectedTotal - baselineTotal
          const ins = baseline
            ? [...plan.driverIds, ...plan.constructorIds].filter(
                (id) => ![...baseline.driverIds, ...baseline.constructorIds].includes(id)
              )
            : [...plan.driverIds, ...plan.constructorIds]
          const outs = baseline
            ? [...baseline.driverIds, ...baseline.constructorIds].filter(
                (id) => ![...plan.driverIds, ...plan.constructorIds].includes(id)
              )
            : []

          return (
            <Collapsible key={t} className="rounded-md border border-grid-line/60">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-f1">
                <span className="flex items-center gap-2">
                  <span>
                    {t} transfer{t === 1 ? "" : "s"}
                  </span>
                  <Delta value={gain} points className="font-mono text-xs" />
                  {t === result.best.transfers && (
                    <span className="text-xs text-accent-f1">← recommended</span>
                  )}
                  {plan.penaltyPoints < 0 && (
                    <span className="text-xs text-neg">
                      (−{Math.abs(plan.penaltyPoints)} penalty)
                    </span>
                  )}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
                {ins.map((inId, i) => {
                  const outId = outs[i]
                  return (
                    <div key={inId} className="flex flex-col gap-1">
                      <p className="text-xs">
                        {outId && (
                          <span className="text-muted-foreground line-through">
                            {nameOf(outId)}{" "}
                          </span>
                        )}
                        <span aria-hidden="true">→ </span>
                        <span className="font-medium">{nameOf(inId)}</span>
                      </p>
                      <AssetMath proj={projection.byPlayerId[inId]} asset={assetsById[inId]} />
                    </div>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          )
        })}

        <p className="border-t border-grid-line pt-2 text-xs text-muted-foreground">
          Projected with {presetLabel(projection.effectivePreset)}, based on {completedRaces}{" "}
          completed race{completedRaces === 1 ? "" : "s"}
          {completedSprints > 0
            ? `, ${completedSprints} sprint${completedSprints === 1 ? "" : "s"}`
            : ""}
          .
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
