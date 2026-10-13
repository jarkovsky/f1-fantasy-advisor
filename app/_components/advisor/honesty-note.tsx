"use client"

import { useTeamStore } from "@/lib/team/store"

import { Card } from "@/components/ui/card"

/**
 * The standing disclaimer that projections are not predictions. Dismissible;
 * once dismissed it stays hidden (persisted in the team store).
 */
export function HonestyNote() {
  const { state, dismissHonestyNote } = useTeamStore()
  if (state.dismissedHonestyNote) return null

  return (
    <Card className="relative gap-0 bg-surface-1 p-4 text-xs text-muted-foreground">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissHonestyNote}
        className="absolute top-2 right-2 rounded-sm px-1.5 py-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent-f1"
      >
        ✕
      </button>
      <p className="pr-6 leading-relaxed">
        These are projections from public stats, not predictions. The optimizer finds the
        mathematically best squad for the chosen model — it can&apos;t see crashes, weather, or
        strategy. Use it as a starting point.
      </p>
    </Card>
  )
}
