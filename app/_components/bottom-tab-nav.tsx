"use client"

import Link from "next/link"
import { ChartColumn, Lightbulb, Users } from "lucide-react"

import { cn } from "@/lib/utils"

type Section = "team" | "advice"

interface BottomTabNavProps {
  active: Section
  onSelect: (section: Section) => void
}

const TAB =
  "relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"

/** 2px top indicator on the active in-page tab (motion-safe only). */
const INDICATOR =
  "absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent-f1 motion-safe:transition-opacity"

/**
 * Mobile bottom tab bar (below lg only). Dumb/presentational — no store access:
 * Advice/Team toggle in-page sections via `onSelect`; Stats is a real route
 * link. Hidden at lg where the two-column grid shows both sections at once.
 */
export function BottomTabNav({ active, onSelect }: BottomTabNavProps) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-grid-line bg-surface-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <button
        type="button"
        aria-pressed={active === "advice"}
        onClick={() => onSelect("advice")}
        className={cn(
          TAB,
          active === "advice" ? "text-accent-f1" : "text-muted-foreground"
        )}
      >
        <span
          aria-hidden
          className={cn(
            INDICATOR,
            active === "advice" ? "opacity-100" : "opacity-0"
          )}
        />
        <Lightbulb aria-hidden className="size-5" />
        Advice
      </button>

      <button
        type="button"
        aria-pressed={active === "team"}
        onClick={() => onSelect("team")}
        className={cn(
          TAB,
          active === "team" ? "text-accent-f1" : "text-muted-foreground"
        )}
      >
        <span
          aria-hidden
          className={cn(
            INDICATOR,
            active === "team" ? "opacity-100" : "opacity-0"
          )}
        />
        <Users aria-hidden className="size-5" />
        Team
      </button>

      <Link
        href="/stats"
        aria-label="Stats"
        className={cn(TAB, "text-muted-foreground")}
      >
        <ChartColumn aria-hidden className="size-5" />
        Stats
      </Link>
    </nav>
  )
}
