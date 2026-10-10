import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { SortDir } from "@/hooks/use-sortable-columns"

/**
 * A sortable table-header cell: a right-aligned button that cycles the sort and
 * an aria-sort reflecting the current state (paired with useSortableColumns). A
 * ▼/▲ glyph marks the active column; screen readers get aria-sort + the hook's
 * live-region announcement.
 */
export function SortableHead({
  label,
  active,
  dir,
  onCycle,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onCycle: () => void
  className?: string
}) {
  const ariaSort = active ? (dir === "desc" ? "descending" : "ascending") : "none"
  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn("sticky top-0 z-10 bg-surface-2 text-right", className)}
    >
      <button
        type="button"
        onClick={onCycle}
        className="inline-flex w-full items-center justify-end gap-1 font-medium tabular-nums hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
      >
        {label}
        {active && <span aria-hidden="true">{dir === "desc" ? "▼" : "▲"}</span>}
      </button>
    </TableHead>
  )
}
