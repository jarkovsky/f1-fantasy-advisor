"use client"

import { useMemo } from "react"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"

import {
  type SortableColumn,
  type SortState,
  useSortableColumns,
} from "@/hooks/use-sortable-columns"

import { TeamColorBar } from "@/app/_components/shared/team-color-bar"
import { SortableHead } from "@/app/_components/shared/sortable-head"
import { NumCell } from "@/app/_components/shared/num-cell"

/**
 * A searchable, sortable table for a single asset kind; the picker stacks one
 * for Drivers and one for Constructors. Selection, quota, and the search query
 * are owned by the container (team-picker.tsx) and arrive via props.
 *
 * Sorting uses the shared useSortableColumns + SortableHead so every table in
 * the app behaves the same. Announcements are prefixed with the table heading
 * so the two tables' live regions stay distinguishable.
 */

type SortKey = "price" | "pts" | "ppm" | "sel"

/** Most-expensive-first is the natural entry point into a picker. */
const DEFAULT_SORT: SortState<SortKey> = { key: "price", dir: "desc" }

const COLUMNS: SortableColumn<SortKey, AssetLite>[] = [
  { key: "price", label: "Price", value: (a) => a.priceTenths },
  { key: "pts", label: "Pts", value: (a) => a.seasonPoints },
  { key: "ppm", label: "PPM", value: (a) => ppmValue(a) },
  { key: "sel", label: "Sel%", value: (a) => a.selectedPercent },
]

/** Points-per-million; null at price 0 (sorts last, renders an em dash). */
function ppmValue(a: AssetLite): number | null {
  if (a.priceTenths === 0) return null
  return a.seasonPoints / (a.priceTenths / 10)
}

type PickerTableProps = {
  /** Assets of a single kind; the container splits drivers from constructors. */
  assets: AssetLite[]
  /** Table heading ("Drivers" / "Constructors"); prefixes sort announcements. */
  heading: string
  selected: ReadonlySet<string>
  /** Kind quota full → unselected rows are disabled. */
  quotaFull: boolean
  /** Shared search query from the container's single search box. */
  query: string
  onToggle: (id: string) => void
}

export function PickerTable({
  assets,
  heading,
  selected,
  quotaFull,
  query,
  onToggle,
}: PickerTableProps) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === "") return assets
    return assets.filter(
      (a) =>
        a.displayName.toLowerCase().includes(needle) ||
        a.fullName.toLowerCase().includes(needle) ||
        a.tla.toLowerCase().includes(needle)
    )
  }, [assets, query])

  const { sorted, sort, cycle, announcement } = useSortableColumns({
    rows: filtered,
    columns: COLUMNS,
    defaultSort: DEFAULT_SORT,
    announceHeading: heading,
  })

  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      {/* Rendered from the first paint so assistive tech registers the region
          before the first sort change. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <h3 className="text-sm font-semibold">
        {heading} <span className="font-normal text-muted-foreground">({assets.length})</span>
      </h3>

      {/* shadcn's Table wraps itself in an overflow-x-auto container, so it
          scrolls horizontally on narrow screens without an extra wrapper. */}
      <Table>
        <TableHeader>
          <TableRow className="border-grid-line hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 w-0 bg-surface-2">
              <span className="sr-only">Selected</span>
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-surface-2">Asset</TableHead>
            {COLUMNS.map((col) => (
              <SortableHead
                key={col.key}
                label={col.label}
                active={sort.key === col.key}
                dir={sort.dir}
                onCycle={() => cycle(col.key)}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow className="border-grid-line hover:bg-transparent">
              <TableCell
                colSpan={2 + COLUMNS.length}
                className="text-center text-sm text-muted-foreground"
              >
                No matches.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((asset) => (
              <PickerRow
                key={asset.playerId}
                asset={asset}
                selected={selected.has(asset.playerId)}
                disabled={quotaFull && !selected.has(asset.playerId)}
                onToggle={onToggle}
              />
            ))
          )}
        </TableBody>
      </Table>
    </section>
  )
}

type PickerRowProps = {
  asset: AssetLite
  selected: boolean
  /** Kind quota full and this asset is not already selected. */
  disabled: boolean
  onToggle: (id: string) => void
}

/**
 * One asset row. The leading Checkbox is the selection source of truth: its
 * onCheckedChange drives toggles, so Space on a focused checkbox works natively.
 * The whole row is also a click target for easier reach, but clicks that
 * originate on the checkbox are skipped there, because Radix fires
 * onCheckedChange and also bubbles a row click for the same gesture, which would
 * otherwise toggle twice.
 */
function PickerRow({ asset, selected, disabled, onToggle }: PickerRowProps) {
  const color = teamColor(assetColorKey(asset))
  const ppm = ppmValue(asset)

  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>): void {
    if (disabled) return
    if ((e.target as HTMLElement).closest("[data-slot=checkbox]")) return
    onToggle(asset.playerId)
  }

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      onClick={handleRowClick}
      className={cn(
        "border-grid-line",
        disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
      )}
    >
      <TableCell className="pr-0">
        <Checkbox
          checked={selected}
          disabled={disabled}
          aria-label={`Select ${asset.fullName}`}
          onCheckedChange={() => onToggle(asset.playerId)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TeamColorBar color={color} className="h-5" />
          <span className="font-mono text-xs font-semibold">{asset.tla}</span>
          <span className="truncate text-muted-foreground">{asset.fullName}</span>
        </div>
      </TableCell>
      <NumCell>{formatPriceTenths(asset.priceTenths)}</NumCell>
      <NumCell>{asset.seasonPoints}</NumCell>
      <NumCell>{ppm === null ? "—" : ppm.toFixed(1)}</NumCell>
      <NumCell>{asset.selectedPercent}%</NumCell>
    </TableRow>
  )
}
