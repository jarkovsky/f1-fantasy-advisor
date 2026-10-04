"use client"

import { useMemo, useState } from "react"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDeltaTenths, formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { Sparkline } from "./sparkline"

/**
 * Plain JSON row shipped from the server fetcher (asset-table.tsx). No class
 * instances, no methods — fully serializable across the RSC ⇄ island boundary.
 * Nullable numerics (`form5`, the per-session averages, `ppm`) render an em
 * dash and always sort last.
 */
export type StatsRow = {
  playerId: string
  kind: "driver" | "constructor"
  displayName: string
  tla: string
  teamName: string | null
  /** team-colors join key (assetColorKey) — drives the decorative bar only. */
  colorKey: string | null
  priceTenths: number
  priceDeltaTenths: number
  seasonPoints: number
  ppm: number | null
  form5: number | null
  qualiAvg: number | null
  raceAvg: number | null
  sprintAvg: number | null
  selectedPercent: number
  captainSelectedPercent: number
  spark: number[]
}

type NumericKey =
  | "priceTenths"
  | "priceDeltaTenths"
  | "seasonPoints"
  | "ppm"
  | "form5"
  | "qualiAvg"
  | "raceAvg"
  | "sprintAvg"
  | "selectedPercent"
  | "captainSelectedPercent"

type SortDir = "desc" | "asc"
type SortState = { key: NumericKey; dir: SortDir }

const DEFAULT_SORT: SortState = { key: "seasonPoints", dir: "desc" }

type Column = { key: NumericKey; label: string }

const COLUMNS: Column[] = [
  { key: "priceTenths", label: "Price" },
  { key: "priceDeltaTenths", label: "Δ price" },
  { key: "seasonPoints", label: "Season pts" },
  { key: "ppm", label: "PPM" },
  { key: "form5", label: "Form-5" },
  { key: "qualiAvg", label: "Quali avg" },
  { key: "raceAvg", label: "Race avg" },
  { key: "sprintAvg", label: "Sprint avg" },
  { key: "selectedPercent", label: "Sel%" },
  { key: "captainSelectedPercent", label: "Capt%" },
]

/** Nulls always last (both directions); otherwise numeric (never lexicographic). */
function compare(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "desc" ? b - a : a - b
}

function sortRows(rows: StatsRow[], sort: SortState): StatsRow[] {
  return [...rows].sort((x, y) => compare(x[sort.key], y[sort.key], sort.dir))
}

export function StatsTable({ rows, caption }: { rows: StatsRow[]; caption: string }) {
  const drivers = useMemo(() => rows.filter((r) => r.kind === "driver"), [rows])
  const constructors = useMemo(() => rows.filter((r) => r.kind === "constructor"), [rows])

  return (
    // Sorting state lives PER PANEL (each <StatsPanel> owns its own useState).
    // Radix remounts the inactive panel's content, so switching tabs resets
    // sort to the default — the simplest correct behavior (noted in spec).
    <Tabs defaultValue="driver" className="gap-3">
      <TabsList>
        <TabsTrigger value="driver">Drivers ({drivers.length})</TabsTrigger>
        <TabsTrigger value="constructor">Constructors ({constructors.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="driver">
        <StatsPanel rows={drivers} caption={caption} />
      </TabsContent>
      <TabsContent value="constructor">
        <StatsPanel rows={constructors} caption={caption} />
      </TabsContent>
    </Tabs>
  )
}

function StatsPanel({ rows, caption }: { rows: StatsRow[]; caption: string }) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  // The last announced sort change for the sr-only live region. Empty at first
  // render (the region must still exist so AT registers it before any change).
  const [announcement, setAnnouncement] = useState("")

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])

  function cycle(key: NumericKey) {
    setSort((prev) => {
      // desc → asc → none(=default). A fresh column starts at desc.
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

  return (
    <>
      {/* sr-only live region — present from first render so AT registers it
          before any sort change; updates politely on each cycle. Lives OUTSIDE
          the table (a table allows only one <caption>). */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
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
            <TableHead className="sticky top-0 z-10 bg-surface-2 text-right">Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <DataRow key={row.playerId} row={row} />
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function DataRow({ row }: { row: StatsRow }) {
  return (
    <TableRow className="border-grid-line">
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-5 w-[3px] shrink-0 rounded-full"
            style={{ background: teamColor(row.colorKey) }}
          />
          <span className="font-mono text-xs font-semibold">{row.tla}</span>
          <span className="text-muted-foreground">{row.displayName}</span>
        </div>
      </TableCell>
      <NumCell>{formatPriceTenths(row.priceTenths)}</NumCell>
      <TableCell className="text-right font-mono tabular-nums">
        <DeltaSpan tenths={row.priceDeltaTenths} />
      </TableCell>
      <NumCell>{row.seasonPoints}</NumCell>
      <NumCell>{fmt1(row.ppm)}</NumCell>
      <NumCell>{fmt1(row.form5)}</NumCell>
      <NumCell>{fmt1(row.qualiAvg)}</NumCell>
      <NumCell>{fmt1(row.raceAvg)}</NumCell>
      <NumCell>{fmt1(row.sprintAvg)}</NumCell>
      <NumCell>{row.selectedPercent}%</NumCell>
      <NumCell>{row.captainSelectedPercent}%</NumCell>
      <TableCell className="text-right">
        <span className="inline-flex justify-end">
          <Sparkline series={row.spark} />
        </span>
      </TableCell>
    </TableRow>
  )
}

function NumCell({ children }: { children: React.ReactNode }) {
  return <TableCell className="text-right font-mono tabular-nums">{children}</TableCell>
}

/**
 * Δ price: sign glyph + sentiment color. COLOR NEVER WITHOUT THE GLYPH — the
 * +/− sign (and the bare middle dot for zero) is part of the text, so color is
 * decorative reinforcement (mirrors lib/format conventions + the advisor's
 * <Delta>; we don't import that one — it lives under app/_components).
 */
function DeltaSpan({ tenths }: { tenths: number }) {
  const tone = tenths > 0 ? "text-pos" : tenths < 0 ? "text-neg" : "text-muted-foreground"
  return <span className={cn(tone)}>{formatDeltaTenths(tenths)}</span>
}

/** One-decimal numeric, em dash for null. */
function fmt1(v: number | null): string {
  return v === null ? "—" : v.toFixed(1)
}
