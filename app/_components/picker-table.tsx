"use client"

import { useId, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
 * The single searchable data table of ALL assets — drivers and constructors in
 * one list (the user's M5 redesign: the old two-tab card grid showed the TLA
 * twice, once in a monogram and again in the label, which they flagged). This is
 * a DUMB component: it owns search/filter/sort UI state only. Selection and
 * quota validation live in the container (team-picker.tsx) and arrive via props,
 * so the table never knows the squad rules — it just renders `selected`,
 * disables rows the container says are blocked, and reports toggles back.
 *
 * Sorting mirrors stats-table.tsx EXACTLY (SortState, desc→asc→default cycle,
 * aria-sort on the th, nulls last, an sr-only role=status announcement) so the
 * two tables behave identically for keyboard + screen-reader users. Default
 * order is price descending (the most expensive assets first).
 */

type FilterKind = "all" | "driver" | "constructor"

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
  assets: AssetLite[]
  selected: ReadonlySet<string>
  /** Driver quota full → unselected drivers are disabled. */
  driversFull: boolean
  /** Constructor quota full → unselected constructors are disabled. */
  constructorsFull: boolean
  onToggle: (id: string) => void
}

export function PickerTable({
  assets,
  selected,
  driversFull,
  constructorsFull,
  onToggle,
}: PickerTableProps) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterKind>("all")
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  // Last announced sort change for the sr-only live region. Empty at first
  // render (the region must exist so AT registers it before any change).
  const [announcement, setAnnouncement] = useState("")

  const searchId = useId()

  // Counts come from the full list, independent of the active filter/search, so
  // the chips always show the grid totals (Drivers 22 / Constructors 11).
  const driverTotal = useMemo(
    () => assets.filter((a) => a.kind === "driver").length,
    [assets]
  )
  const constructorTotal = useMemo(
    () => assets.filter((a) => a.kind === "constructor").length,
    [assets]
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = assets.filter((a) => {
      if (filter !== "all" && a.kind !== filter) return false
      if (needle === "") return true
      return (
        a.displayName.toLowerCase().includes(needle) ||
        a.fullName.toLowerCase().includes(needle) ||
        a.tla.toLowerCase().includes(needle)
      )
    })
    const column = COLUMNS.find((c) => c.key === sort.key)
    if (!column) return filtered
    return [...filtered].sort((x, y) =>
      compare(column.value(x), column.value(y), sort.dir)
    )
  }, [assets, filter, query, sort])

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
      setAnnouncement(`Sorted by ${label}, ${dirWord}.`)
      return next
    })
  }

  const FILTERS: { key: FilterKind; label: string }[] = [
    { key: "all", label: `All (${driverTotal + constructorTotal})` },
    { key: "driver", label: `Drivers (${driverTotal})` },
    { key: "constructor", label: `Constructors (${constructorTotal})` },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* sr-only live region — present from first render so AT registers it
          before any sort change; updates politely on each cycle. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Toolbar: search + filter chips */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search drivers & constructors…"
          aria-label="Search drivers and constructors"
          className="sm:max-w-xs"
        />
        <div
          role="group"
          aria-label="Filter by kind"
          className="flex gap-1.5 self-start"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <Button
                key={f.key}
                type="button"
                aria-pressed={active}
                variant={active ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* The data table. The shadcn Table already wraps itself in an
          overflow-x-auto container, so it degrades gracefully on mobile. */}
      <Table>
        <TableHeader>
          <TableRow className="border-grid-line hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 w-0 bg-surface-2">
              <span className="sr-only">Selected</span>
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-surface-2">
              Asset
            </TableHead>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key
              const ariaSort = active
                ? sort.dir === "desc"
                  ? "descending"
                  : "ascending"
                : "none"
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
                    {active && (
                      <span aria-hidden="true">
                        {sort.dir === "desc" ? "▼" : "▲"}
                      </span>
                    )}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((asset) => {
            const isSelected = selected.has(asset.playerId)
            const quotaFull =
              asset.kind === "driver" ? driversFull : constructorsFull
            const disabled = quotaFull && !isSelected
            return (
              <PickerRow
                key={asset.playerId}
                asset={asset}
                selected={isSelected}
                disabled={disabled}
                onToggle={onToggle}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
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
          <span className="truncate text-muted-foreground">
            {asset.fullName}
          </span>
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
  return (
    <TableCell className="text-right font-mono tabular-nums">
      {children}
    </TableCell>
  )
}
