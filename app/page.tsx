import { Suspense } from "react"

import { AdvisorData } from "./_components/advisor-data"
import { AdvisorSkeleton } from "./_components/advisor-skeleton"

// Sync shell (prerendered) + one streamed data hole (plan D3). The static
// header renders instantly; <AdvisorData/> streams in behind the skeleton.
export default function AdvisorPage() {
  return (
    <main className="container mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Fantasy F1 Race-Weekend Advisor
        </h1>
        <p className="text-sm text-muted-foreground">
          Optimal transfers and DRS Boost for the upcoming Grand Prix — free,
          with the math shown.
        </p>
      </header>
      <Suspense fallback={<AdvisorSkeleton />}>
        <AdvisorData />
      </Suspense>
    </main>
  )
}
