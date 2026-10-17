/**
 * A titled list of label → value rows, each on its own raised stripe (the
 * profile page's Overview and Points breakdown cards).
 */
export function StatCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: React.ReactNode }[]
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4 shadow-xs ring-1 ring-grid-line">
      <h2 className="text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </h2>
      <dl className="flex flex-col gap-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-1.5 text-sm"
          >
            <dt>{r.label}</dt>
            <dd className="font-mono font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
