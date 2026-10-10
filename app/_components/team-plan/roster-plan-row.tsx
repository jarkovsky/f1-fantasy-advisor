import { Delta } from "@/app/_components/shared/delta"
import { RosterRow } from "@/app/_components/shared/roster-row"
import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import type { SlotRow } from "@/lib/team/squad-diff"
import { teamColor } from "@/lib/team-colors"

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
    // Kept row — the shared RosterRow with price + projection cells.
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

  // Swapped row: out → in, inline per-swap delta.
  const swapDelta = projOf(row.inId) - projOf(row.outId)
  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      {/* Muted color + strikethrough mark the outgoing asset; NO opacity on the
          text wrapper — stacking it under muted-foreground fails WCAG AA
          contrast (caught by the M4 Lighthouse pass). */}
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-3 w-[3px] shrink-0 rounded-full opacity-60"
          style={{ background: colorFor(row.outId) }}
        />
        <span className="truncate text-muted-foreground line-through">{nameOf(row.outId)}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-3 w-[3px] shrink-0 rounded-full"
          style={{ background: colorFor(row.inId) }}
        />
        <span className="truncate font-medium">
          {nameOf(row.inId)}
          {captainChip}
        </span>
      </span>
      <Delta value={swapDelta} points className="font-mono text-xs" />
    </li>
  )
}
