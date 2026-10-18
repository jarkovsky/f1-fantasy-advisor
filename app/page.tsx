import { Suspense } from "react"

import { AdvisorSkeleton } from "./_components/advisor/advisor-skeleton"
import { AdvisorData } from "./_components/advisor/advisor-data"

// Sync shell (prerendered) + one streamed data hole. The static hero renders
// instantly; <AdvisorData/> streams in behind the skeleton.
export default function AdvisorPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-none font-extrabold tracking-tight text-balance uppercase [font-stretch:80%] md:text-5xl">
          Fantasy F1 Race-Weekend Advisor
        </h1>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground md:text-base">
          Optimal transfers and the x2 Boost pick for the upcoming Grand Prix — free, with the math
          shown.
        </p>
      </header>
      <Suspense fallback={<AdvisorSkeleton />}>
        <AdvisorData />
      </Suspense>
    </main>
  )
}
