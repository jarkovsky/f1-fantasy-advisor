import { formatDateISO } from "@/lib/format"

/**
 * The shared "showing snapshot data" degradation notice (spec §8.4: degrade
 * visibly, never crash). Server-safe — no directive, no hooks — so both the
 * server /stats banner and the client advisor banner wrap it. Renders the as-of
 * date as a <time> when parseable, else "an earlier capture"; optional children
 * append a context-specific sentence.
 */
export function StaleDataNotice({
  asOf,
  children,
}: {
  asOf: string | null | undefined
  children?: React.ReactNode
}) {
  const ms = asOf ? Date.parse(asOf) : NaN
  const parseable = !Number.isNaN(ms)
  const label = parseable ? formatDateISO(ms) : "an earlier capture"

  return (
    <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      Live feed unavailable — showing snapshot data as of{" "}
      {parseable ? <time dateTime={new Date(ms).toISOString()}>{label}</time> : label}.{children}
    </p>
  )
}
