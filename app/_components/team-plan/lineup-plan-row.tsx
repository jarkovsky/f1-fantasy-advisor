import type { SlotRow } from "@/lib/team/team-diff"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { TeamColorBar } from "@/app/_components/shared/team-color-bar"
import { LineupRow } from "@/app/_components/shared/lineup-row"
import { Delta } from "@/app/_components/shared/delta"

/**
 * One recommended-team row. A kept slot renders the shared LineupRow (TLA,
 * name, price, projection); a swapped slot renders the bespoke out→in layout
 * with the per-swap delta. The Boost driver gets an "x2" badge either way.
 */
export function LineupPlanRow({
  row,
  boostDriverId,
  assetsById,
  totals,
}: {
  row: SlotRow
  boostDriverId: string
  assetsById: Record<string, AssetLite>
  totals: Record<string, number>
}) {
  const nameOf = (id: string): string => assetsById[id]?.displayName ?? `Asset ${id}`
  const tlaOf = (id: string): string => assetsById[id]?.tla ?? "—"
  const priceOf = (id: string): number => assetsById[id]?.priceTenths ?? 0
  const projOf = (id: string): number => totals[id] ?? 0
  const colorFor = (id: string): string => {
    const a = assetsById[id]
    return teamColor(a ? assetColorKey(a) : null)
  }

  const isBoostDriver = row.inId === boostDriverId
  const boostBadge = isBoostDriver && (
    <span
      className="ml-1.5 inline-flex h-4 items-center justify-center rounded-sm bg-accent-f1-quiet px-1 text-[10px] font-bold text-accent-f1"
      aria-label="x2 Boost driver"
      title="x2 Boost driver"
    >
      x2
    </span>
  )

  if (row.outId === null) {
    return (
      <LineupRow
        color={colorFor(row.inId)}
        tla={tlaOf(row.inId)}
        name={
          <>
            {nameOf(row.inId)}
            {boostBadge}
          </>
        }
      >
        <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatPriceTenths(priceOf(row.inId))}
        </span>
        <span className="w-12 shrink-0 text-right font-mono tabular-nums">
          {projOf(row.inId).toFixed(1)}
        </span>
      </LineupRow>
    )
  }

  const swapDelta = projOf(row.inId) - projOf(row.outId)
  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      {/* Muted color + strikethrough mark the outgoing asset. Opacity goes on
          the color bar only: stacking it on muted-foreground text fails WCAG AA
          contrast. */}
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamColorBar color={colorFor(row.outId)} className="h-3 opacity-60" />
        <span className="truncate text-muted-foreground line-through">{nameOf(row.outId)}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <TeamColorBar color={colorFor(row.inId)} className="h-3" />
        <span className="truncate font-medium">
          {nameOf(row.inId)}
          {boostBadge}
        </span>
      </span>
      <Delta value={swapDelta} points className="font-mono text-xs" />
    </li>
  )
}
