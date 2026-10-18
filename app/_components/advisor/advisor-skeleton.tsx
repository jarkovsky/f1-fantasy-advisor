import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder for the advisor: race widget, the two-column team comparison,
 * and the projection controls. Shared by the page's Suspense
 * fallback (while <AdvisorData/> streams) and the island's pre-mount shell, so
 * neither hand-off shifts the layout. Purely decorative — hidden from AT.
 */
export function AdvisorSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-hidden>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]">
        <Skeleton className="h-[40rem] rounded-xl" />
        <Skeleton className="col-start-3 h-[40rem] rounded-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}
