import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder for the advisor: the two-column team comparison, then the
 * widget row (projection model, chips, race weekend). Shared by the page's
 * Suspense fallback (while <AdvisorData/> streams) and the island's pre-mount
 * shell, so neither hand-off shifts the layout. Purely decorative — hidden
 * from AT.
 */
export function AdvisorSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-hidden>
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]">
        <Skeleton className="h-[40rem] rounded-xl" />
        <Skeleton className="col-start-3 h-[40rem] rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  )
}
