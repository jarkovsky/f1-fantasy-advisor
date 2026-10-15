import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder for the single-column advisor. Shared by the page's Suspense
 * fallback (while <AdvisorData/> streams) and the island's pre-mount shell, so
 * neither hand-off shifts the layout. Purely decorative — hidden from AT.
 */
export function AdvisorSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" aria-hidden>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
