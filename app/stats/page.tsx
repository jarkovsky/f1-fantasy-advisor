import type { Metadata } from "next"
import { Suspense } from "react"

import { AssetTable } from "./_components/asset-table"

export const metadata: Metadata = {
  title: "Stats",
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

// Sync shell (prerendered) + one streamed data hole (the sortable explorer).
export default function StatsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stats explorer</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        All 33 assets from the official F1 Fantasy feed, parsed through the
        typed boundary — prices, season form, per-session splits, selection.
      </p>
      <Suspense fallback={<TableSkeleton />}>
        <AssetTable />
      </Suspense>
    </main>
  )
}
