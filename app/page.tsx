import { Suspense } from "react"

import { AdvisorSkeleton } from "./_components/advisor/advisor-skeleton"
import { AdvisorData } from "./_components/advisor/advisor-data"

// Sync shell (prerendered) + one streamed data hole. The static hero renders
// instantly; <AdvisorData/> streams in behind the skeleton.
export default function AdvisorPage() {
  return (
    <main className="container mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:py-14">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-balance md:text-7xl">
          Fantasy F1 Race-Weekend Advisor
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground md:text-lg">
          Optimal transfers and Boost for the upcoming Grand Prix — free, with the math shown.
        </p>
      </header>
      <Suspense fallback={<AdvisorSkeleton />}>
        <AdvisorData />
      </Suspense>
    </main>
  )
}
