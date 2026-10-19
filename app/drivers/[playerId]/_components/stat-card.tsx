import { InfoTip } from "@/app/_components/shared/info-tip"

type StatRow = { label: string; value: React.ReactNode; info?: React.ReactNode }

/**
 * A titled list of label → value rows, each on its own raised stripe (the
 * profile page's Overview and Points breakdown cards). The title and any row
 * can carry an "i" explaining it.
 */
export function StatCard({
  title,
  info,
  rows,
}: {
  title: string
  info?: React.ReactNode
  rows: StatRow[]
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4 shadow-xs ring-1 ring-grid-line">
      <h2 className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
        {info && <InfoTip label={title.toLowerCase()}>{info}</InfoTip>}
      </h2>
      <dl className="flex flex-col gap-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-1.5 text-sm"
          >
            <dt className="flex items-center gap-1.5">
              {r.label}
              {r.info && <InfoTip label={r.label.toLowerCase()}>{r.info}</InfoTip>}
            </dt>
            <dd className="font-mono font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
