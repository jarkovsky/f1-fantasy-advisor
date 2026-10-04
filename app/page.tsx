import { Suspense } from "react"

import { AdvisorData } from "./_components/advisor-data"
import { AdvisorSkeleton } from "./_components/advisor-skeleton"

// Sync shell (prerendered) + one streamed data hole (plan D3). The static
// header renders instantly; <AdvisorData/> streams in behind the skeleton.
export default function AdvisorPage() {
  return (
    <main className="container mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:py-14">
      {/* Reference-style hero: oversized centered title over the dot-pattern
          page (spec §10 M5). Static markup — lives in the PPR shell. */}
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-balance md:text-7xl">
          Fantasy F1 Race-Weekend Advisor
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground md:text-lg">
          Optimal transfers and DRS Boost for the upcoming Grand Prix — free, with the math shown.
        </p>
      </header>
      <Suspense fallback={<AdvisorSkeleton />}>
        <AdvisorData />
      </Suspense>
    </main>
  )
}
