"use client"

import { useMemo, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

/**
 * One searchable, sortable data table for ONE asset kind — the picker renders
 * two of these, Drivers and Constructors, stacked (the user's M5 follow-up:
 * separate tables beat one combined list with filter chips). This is a DUMB
 * component: it owns sort UI state only. Selection and quota validation live
 * in the container (team-picker.tsx) and arrive via props, as does the shared
 * search query — one search box in the container filters both tables.
 *
 * Sorting mirrors stats-table.tsx EXACTLY (SortState, desc→asc→default cycle,
 * aria-sort on the th, nulls last, an sr-only role=status announcement) so all
 * tables in the app behave identically for keyboard + screen-reader users.
 * Announcements are prefixed with the table heading so the two live regions
 * stay distinguishable. Default order is price descending.
 */

type SortKey = "price" | "pts" | "ppm" | "sel"
type SortDir = "desc" | "asc"
type SortState = { key: SortKey; dir: SortDir }

/** Most-expensive-first is the natural entry point into a picker. */
const DEFAULT_SORT: SortState = { key: "price", dir: "desc" }

type Column = {
  key: SortKey
  label: string
  /** The sortable scalar; null (e.g. PPM at price 0) always sorts last. */
  value: (a: AssetLite) => number | null
}

const COLUMNS: Column[] = [
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

/** Nulls always last (both directions); otherwise numeric. */
function compare(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "desc" ? b - a : a - b
}

type PickerTableProps = {
  /** Assets of ONE kind — the container splits drivers from constructors. */
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
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  // Last announced sort change for the sr-only live region. Empty at first
  // render (the region must exist so AT registers it before any change).
  const [announcement, setAnnouncement] = useState("")

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered =
      needle === ""
        ? assets
        : assets.filter(
            (a) =>
              a.displayName.toLowerCase().includes(needle) ||
              a.fullName.toLowerCase().includes(needle) ||
              a.tla.toLowerCase().includes(needle)
          )
    const column = COLUMNS.find((c) => c.key === sort.key)
    if (!column) return filtered
    return [...filtered].sort((x, y) => compare(column.value(x), column.value(y), sort.dir))
  }, [assets, query, sort])

  function cycle(key: SortKey): void {
    setSort((prev) => {
      // desc → asc → default. A fresh column starts at desc.
      let next: SortState
      if (prev.key !== key) {
        next = { key, dir: "desc" }
      } else if (prev.dir === "desc") {
        next = { key, dir: "asc" }
      } else {
        next = DEFAULT_SORT
      }
      const label = COLUMNS.find((c) => c.key === next.key)?.label ?? next.key
      const dirWord = next.dir === "desc" ? "descending" : "ascending"
      setAnnouncement(`${heading} sorted by ${label}, ${dirWord}.`)
      return next
    })
  }

  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      {/* sr-only live region — present from first render so AT registers it
          before any sort change; updates politely on each cycle. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <h3 className="text-sm font-semibold">
        {heading} <span className="font-normal text-muted-foreground">({assets.length})</span>
      </h3>

      {/* The data table. The shadcn Table already wraps itself in an
          overflow-x-auto container, so it degrades gracefully on mobile. */}
      <Table>
        <TableHeader>
          <TableRow className="border-grid-line hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 w-0 bg-surface-2">
              <span className="sr-only">Selected</span>
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-surface-2">Asset</TableHead>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key
              const ariaSort = active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"
              return (
                <TableHead
                  key={col.key}
                  aria-sort={ariaSort}
                  className="sticky top-0 z-10 bg-surface-2 text-right"
                >
                  <button
                    type="button"
                    onClick={() => cycle(col.key)}
                    className="inline-flex w-full items-center justify-end gap-1 font-medium tabular-nums hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
                  >
                    {col.label}
                    {active && <span aria-hidden="true">{sort.dir === "desc" ? "▼" : "▲"}</span>}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="border-grid-line hover:bg-transparent">
              <TableCell
                colSpan={2 + COLUMNS.length}
                className="text-center text-sm text-muted-foreground"
              >
                No matches.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((asset) => (
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
 * One asset row. The leading Checkbox is the selection source of truth (its
 * onCheckedChange drives toggles, so Space on a focused checkbox just works via
 * native radix). The whole row is also a click target for Fitts'-law reach —
 * but a click that originates from the checkbox is skipped here, because radix
 * fires onCheckedChange AND bubbles a row click for the same gesture, which
 * would otherwise toggle twice. Disabled rows go muted and the checkbox blocks.
 */
function PickerRow({ asset, selected, disabled, onToggle }: PickerRowProps) {
  const color = teamColor(assetColorKey(asset))
  const ppm = ppmValue(asset)

  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>): void {
    if (disabled) return
    // The checkbox already handled its own gesture (see doc comment).
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
          <span
            aria-hidden="true"
            className="h-5 w-[3px] shrink-0 rounded-full"
            style={{ background: color }}
          />
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

function NumCell({ children }: { children: React.ReactNode }) {
  return <TableCell className="text-right font-mono tabular-nums">{children}</TableCell>
}
