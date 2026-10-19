"use client"

import type { StatsRow } from "./stats-row"

import { useMemo, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

import { StatsPanel } from "./stats-panel"

/** Case-insensitive match on the name, TLA or team. */
function matches(row: StatsRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [row.displayName, row.tla, row.teamName ?? ""].some((s) => s.toLowerCase().includes(q))
}

/**
 * The stats explorer on one card surface, like the advisor's team picker: the
 * Drivers / Constructors tabs and a shared search box over the sortable table.
 * The tab counts stay the full grid; the search only narrows the rows.
 */
export function StatsTable({ rows, caption }: { rows: StatsRow[]; caption: string }) {
  const [query, setQuery] = useState("")
  const drivers = useMemo(() => rows.filter((r) => r.kind === "driver"), [rows])
  const constructors = useMemo(() => rows.filter((r) => r.kind === "constructor"), [rows])

  return (
    // Sort state lives per panel (each <StatsPanel> owns its own hook state).
    // Radix unmounts the inactive panel's content, so switching tabs resets
    // sort to the default — the simplest correct behavior.
    <Tabs
      defaultValue="driver"
      className="gap-3 rounded-xl bg-surface-1 p-3 shadow-xs ring-1 ring-grid-line sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="driver">Drivers ({drivers.length})</TabsTrigger>
          <TabsTrigger value="constructor">Constructors ({constructors.length})</TabsTrigger>
        </TabsList>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search drivers & constructors…"
          aria-label="Search drivers and constructors"
          className="sm:max-w-xs"
        />
      </div>
      <TabsContent value="driver">
        <StatsPanel rows={drivers.filter((r) => matches(r, query))} caption={caption} />
      </TabsContent>
      <TabsContent value="constructor">
        <StatsPanel rows={constructors.filter((r) => matches(r, query))} caption={caption} />
      </TabsContent>
    </Tabs>
  )
}
