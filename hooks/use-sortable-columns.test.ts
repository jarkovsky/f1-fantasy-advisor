import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { type SortableColumn, type SortState, useSortableColumns } from "./use-sortable-columns"

type Row = { id: string; n: number | null; m: number | null }

// a=3, d=2, b=1, c=null → the null always sorts last, both directions.
const ROWS: Row[] = [
  { id: "a", n: 3, m: 10 },
  { id: "b", n: 1, m: 40 },
  { id: "c", n: null, m: 20 },
  { id: "d", n: 2, m: 30 },
]

const COLUMNS: SortableColumn<"n" | "m", Row>[] = [
  { key: "n", label: "N", value: (r) => r.n },
  { key: "m", label: "M", value: (r) => r.m },
]

const DEFAULT_SORT: SortState<"n" | "m"> = { key: "n", dir: "desc" }

function setup(announceHeading?: string) {
  return renderHook(() =>
    useSortableColumns({ rows: ROWS, columns: COLUMNS, defaultSort: DEFAULT_SORT, announceHeading })
  )
}

describe("useSortableColumns", () => {
  it("applies the default sort (desc, nulls last) with an empty initial announcement", () => {
    const { result } = setup()
    expect(result.current.sorted.map((r) => r.id)).toEqual(["a", "d", "b", "c"])
    expect(result.current.sort).toEqual({ key: "n", dir: "desc" })
    expect(result.current.announcement).toBe("")
  })

  it("cycles the active column desc → asc → default, nulls last both ways", () => {
    const { result } = setup()
    act(() => result.current.cycle("n")) // desc → asc
    expect(result.current.sort).toEqual({ key: "n", dir: "asc" })
    expect(result.current.sorted.map((r) => r.id)).toEqual(["b", "d", "a", "c"])
    act(() => result.current.cycle("n")) // asc → default (desc)
    expect(result.current.sort).toEqual({ key: "n", dir: "desc" })
    expect(result.current.sorted.map((r) => r.id)).toEqual(["a", "d", "b", "c"])
  })

  it("a fresh column starts at desc", () => {
    const { result } = setup()
    act(() => result.current.cycle("m"))
    expect(result.current.sort).toEqual({ key: "m", dir: "desc" })
    expect(result.current.sorted.map((r) => r.id)).toEqual(["b", "d", "c", "a"])
  })

  it("announces with the heading prefix when provided", () => {
    const { result } = setup("Drivers")
    act(() => result.current.cycle("m"))
    expect(result.current.announcement).toBe("Drivers sorted by M, descending.")
    act(() => result.current.cycle("m"))
    expect(result.current.announcement).toBe("Drivers sorted by M, ascending.")
  })

  it("announces without a heading (stats wording) when omitted", () => {
    const { result } = setup()
    act(() => result.current.cycle("m"))
    expect(result.current.announcement).toBe("Sorted by M, descending.")
  })
})
