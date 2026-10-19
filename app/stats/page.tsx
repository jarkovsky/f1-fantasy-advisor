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
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
      {/* Same header treatment as the advisor page (app/page.tsx). */}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-none font-extrabold tracking-tight text-balance uppercase [font-stretch:80%] md:text-5xl">
          Stats explorer
        </h1>
      </header>
      <Suspense fallback={<TableSkeleton />}>
        <AssetTable />
      </Suspense>
    </main>
  )
}
