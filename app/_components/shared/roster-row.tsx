import { TeamColorBar } from "./team-color-bar"

/**
 * One roster `<li>`: the team-color spine, an optional TLA column, a truncating
 * name, and caller-supplied right-aligned metric cells (price, projection,
 * points). Shared by the team-plan card's kept rows, the locked view, the
 * season-ended squad, and the rollover squad step.
 */
export function RosterRow({
  color,
  tla,
  name,
  children,
}: {
  color: string
  /** Renders the w-10 mono TLA column when present. */
  tla?: string
  name: React.ReactNode
  /** Right-aligned metric cells (widths owned by the caller). */
  children?: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <TeamColorBar color={color} />
      {tla !== undefined && (
        <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{tla}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {children}
    </li>
  )
}
