"use client"

import type { StatsRow } from "./stats-row"

import { useMemo } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { StatsPanel } from "./stats-panel"

export function StatsTable({ rows, caption }: { rows: StatsRow[]; caption: string }) {
  const drivers = useMemo(() => rows.filter((r) => r.kind === "driver"), [rows])
  const constructors = useMemo(() => rows.filter((r) => r.kind === "constructor"), [rows])

  return (
    // Sort state lives per panel (each <StatsPanel> owns its own hook state).
    // Radix unmounts the inactive panel's content, so switching tabs resets
    // sort to the default — the simplest correct behavior.
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
