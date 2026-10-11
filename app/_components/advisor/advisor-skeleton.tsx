import { Skeleton } from "@/components/ui/skeleton"

/**
 * Suspense fallback for <AdvisorData/>. Approximates the two-column advisor
 * layout (header strip + hero card left, three rail cards right) so the
 * streamed swap doesn't shift the page. Purely decorative — hidden from AT.
 */
export function AdvisorSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {/* Header strip: state badge + race name + deadline. */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="ml-auto h-5 w-40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Hero card (left): recommendation headline + roster grid. */}
        <div className="flex flex-col gap-4 rounded-xl border border-grid-line bg-surface-1 p-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-prose" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>

        {/* Rail (right): three stacked cards. */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-grid-line bg-surface-1 p-4"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
