"use client"

import { useMemo, useState } from "react"

/**
 * The shared sort engine behind every data table (drivers/constructors picker,
 * the stats explorer). Owns sort UI state only: desc → asc → default cycling,
 * nulls-last numeric compare, and an sr-only announcement string the caller
 * renders into its own role="status" live region. The rendered header lives in
 * the SortableHead component; this hook is headless.
 */

export type SortDir = "desc" | "asc"

export type SortState<K extends string> = { key: K; dir: SortDir }

export type SortableColumn<K extends string, Row> = {
  key: K
  label: string
  /** The sortable scalar; null always sorts last (both directions). */
  value: (row: Row) => number | null
}

/** Nulls always last (both directions); otherwise numeric (never lexicographic). */
function compare(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "desc" ? b - a : a - b
}

export function useSortableColumns<K extends string, Row>(options: {
  rows: readonly Row[]
  columns: readonly SortableColumn<K, Row>[]
  defaultSort: SortState<K>
  /** "Drivers" → "Drivers sorted by …"; omitted → "Sorted by …" (stats wording). */
  announceHeading?: string
}): {
  sorted: Row[]
  sort: SortState<K>
  cycle: (key: K) => void
  /** "" until the first cycle — the region must exist before any change. */
  announcement: string
} {
  const { rows, columns, defaultSort, announceHeading } = options
  const [sort, setSort] = useState<SortState<K>>(defaultSort)
  const [announcement, setAnnouncement] = useState("")

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort.key)
    if (!column) return [...rows]
    return [...rows].sort((x, y) => compare(column.value(x), column.value(y), sort.dir))
  }, [rows, columns, sort])

  function cycle(key: K): void {
    setSort((prev) => {
      // desc → asc → default. A fresh column starts at desc.
      let next: SortState<K>
      if (prev.key !== key) {
        next = { key, dir: "desc" }
      } else if (prev.dir === "desc") {
        next = { key, dir: "asc" }
      } else {
        next = defaultSort
      }
      const label = columns.find((c) => c.key === next.key)?.label ?? next.key
      const dirWord = next.dir === "desc" ? "descending" : "ascending"
      setAnnouncement(
        announceHeading
          ? `${announceHeading} sorted by ${label}, ${dirWord}.`
          : `Sorted by ${label}, ${dirWord}.`
      )
      return next
    })
  }

  return { sorted, sort, cycle, announcement }
}
