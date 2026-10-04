"use client"

import { Button } from "@/components/ui/button"

/**
 * A roster id with no row in the current race feed (a driver/constructor that
 * dropped out mid-season). The store keeps only ids, so a healed roster still
 * references it; the user must replace it to continue. Replacing an unavailable
 * asset still costs a transfer (the optimizer counts the swap naturally).
 */
type UnavailableAssetTileProps = {
  id: string
  displayName?: string
  onReplace?: () => void
}

export function UnavailableAssetTile({ id, displayName, onReplace }: UnavailableAssetTileProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md bg-surface-2 py-2 pr-3 pl-3"
      style={{ borderLeft: "3px solid var(--warn)" }}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {displayName ?? `Asset ${id}`} — no longer available.
        </p>
        <p className="text-xs text-muted-foreground">
          Not in the current race feed. Replace it to continue — replacing an unavailable asset
          still uses a transfer.
        </p>
      </div>
      {onReplace && (
        <Button type="button" variant="ghost" size="sm" onClick={onReplace} className="shrink-0">
          Replace
        </Button>
      )}
    </div>
  )
}
