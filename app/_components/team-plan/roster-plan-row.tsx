import type { SlotRow } from "@/lib/team/squad-diff"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { TeamColorBar } from "@/app/_components/shared/team-color-bar"
import { RosterRow } from "@/app/_components/shared/roster-row"
import { Delta } from "@/app/_components/shared/delta"

/**
 * One recommended-squad row. A kept slot renders the shared RosterRow (TLA,
 * name, price, projection); a swapped slot renders the bespoke out→in layout
 * with the per-swap delta. The DRS captain gets a "C" chip either way.
 */
export function RosterPlanRow({
  row,
  captainId,
  assetsById,
  totals,
}: {
  row: SlotRow
  captainId: string
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

  const isCaptain = row.inId === captainId
  const captainChip = isCaptain && (
    <span
      className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-f1-quiet text-[10px] font-bold text-accent-f1"
      aria-label="DRS Boost captain"
      title="DRS Boost captain"
    >
      C
    </span>
  )

  if (row.outId === null) {
    return (
      <RosterRow
        color={colorFor(row.inId)}
        tla={tlaOf(row.inId)}
        name={
          <>
            {nameOf(row.inId)}
            {captainChip}
          </>
        }
      >
        <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatPriceTenths(priceOf(row.inId))}
        </span>
        <span className="w-12 shrink-0 text-right font-mono tabular-nums">
          {projOf(row.inId).toFixed(1)}
        </span>
      </RosterRow>
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
          {captainChip}
        </span>
      </span>
      <Delta value={swapDelta} points className="font-mono text-xs" />
    </li>
  )
}
