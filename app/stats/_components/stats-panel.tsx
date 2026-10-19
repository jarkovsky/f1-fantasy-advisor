"use client"

import type { StatsRow } from "./stats-row"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  type SortableColumn,
  type SortState,
  useSortableColumns,
} from "@/hooks/use-sortable-columns"

import { SortableHead } from "@/app/_components/shared/sortable-head"

import { DataRow } from "./data-row"

type SortKey =
  | "priceTenths"
  | "priceDeltaTenths"
  | "seasonPoints"
  | "ppm"
  | "form5"
  | "qualiAvg"
  | "raceAvg"
  | "sprintAvg"
  | "selectedPercent"
  | "boostedPercent"

const DEFAULT_SORT: SortState<SortKey> = { key: "seasonPoints", dir: "desc" }

const COLUMNS: SortableColumn<SortKey, StatsRow>[] = [
  { key: "priceTenths", label: "Price", value: (r) => r.priceTenths },
  { key: "priceDeltaTenths", label: "Δ price", value: (r) => r.priceDeltaTenths },
  { key: "seasonPoints", label: "Season pts", value: (r) => r.seasonPoints },
  { key: "ppm", label: "PPM", value: (r) => r.ppm },
  { key: "form5", label: "Form-5", value: (r) => r.form5 },
  { key: "qualiAvg", label: "Quali avg", value: (r) => r.qualiAvg },
  { key: "raceAvg", label: "Race avg", value: (r) => r.raceAvg },
  { key: "sprintAvg", label: "Sprint avg", value: (r) => r.sprintAvg },
  { key: "selectedPercent", label: "% Picked", value: (r) => r.selectedPercent },
  { key: "boostedPercent", label: "% Boosted", value: (r) => r.boostedPercent },
]

export function StatsPanel({ rows, caption }: { rows: StatsRow[]; caption: string }) {
  const { sorted, sort, cycle, announcement } = useSortableColumns({
    rows,
    columns: COLUMNS,
    defaultSort: DEFAULT_SORT,
  })

  return (
    <>
      {/* sr-only live region — present from first render so AT registers it
          before any sort change; updates politely on each cycle. Lives outside
          the table (a table allows only one <caption>). */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
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
            <TableHead className="sticky top-0 z-10 bg-surface-2 text-right">Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2 + COLUMNS.length}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                No matches.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row) => <DataRow key={row.playerId} row={row} />)
          )}
        </TableBody>
      </Table>
    </>
  )
}
