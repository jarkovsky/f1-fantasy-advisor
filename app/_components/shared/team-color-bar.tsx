import { cn } from "@/lib/utils"

/**
 * The decorative team-color spine that leads a roster or table row. Purely
 * decorative (aria-hidden) — color is never the sole information carrier. Pass a
 * resolved color value (teamColor(assetColorKey(...))); height varies by context
 * via className (default h-4; tables pass h-5).
 */
export function TeamColorBar({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-4 w-[3px] shrink-0 rounded-full", className)}
      style={{ background: color }}
    />
  )
}
