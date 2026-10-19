import { Plus, X } from "lucide-react"
import { useId } from "react"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { teamColor } from "@/lib/team-colors"

import { TeamColorBar } from "@/app/_components/shared/team-color-bar"

/**
 * One half of the picker's selection summary: "Drivers 2/5" over the picks so
 * far, each removable, then one empty slot per open place, so the count and
 * what fills it read together. An empty slot is a button that jumps to the
 * matching table.
 */
export function PickedList({
  heading,
  slotLabel,
  assets,
  quota,
  onRemove,
  onPickMore,
}: {
  heading: string
  /** Empty-slot text, e.g. "Pick a driver". */
  slotLabel: string
  assets: AssetLite[]
  quota: number
  onRemove: (id: string) => void
  onPickMore: () => void
}) {
  const headingId = useId()
  const open = Math.max(0, quota - assets.length)

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="flex items-baseline justify-between text-sm font-medium">
        {heading}{" "}
        <span className="font-mono text-muted-foreground tabular-nums">
          {assets.length}/{quota}
        </span>
      </h3>
      <ul className="flex flex-col gap-1">
        {assets.map((asset) => (
          <li
            key={asset.playerId}
            className="flex h-8 items-center gap-2 rounded-md bg-surface-2 pr-1 pl-2 text-sm"
          >
            <TeamColorBar color={teamColor(assetColorKey(asset))} />
            <span className="min-w-0 flex-1 truncate">{asset.displayName}</span>
            <button
              type="button"
              aria-label={`Remove ${asset.displayName}`}
              onClick={() => onRemove(asset.playerId)}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent-f1"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
        {Array.from({ length: open }, (_, i) => (
          <li key={`open-${i}`}>
            <button
              type="button"
              onClick={onPickMore}
              className="flex h-8 w-full items-center gap-1.5 rounded-md border border-dashed border-grid-line px-2 text-xs text-muted-foreground/70 outline-none hover:border-grid-line-strong hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent-f1"
            >
              <Plus aria-hidden="true" className="size-3" />
              {slotLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
