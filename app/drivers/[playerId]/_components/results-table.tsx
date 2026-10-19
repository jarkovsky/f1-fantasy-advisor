import type { RaceResultRow } from "@/lib/profile/race-results"

import { formatPoints, formatPriceTenths } from "@/lib/format"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { CountryFlag } from "@/app/_components/shared/country-flag"
import { NumCell } from "@/app/_components/shared/num-cell"

/** The season, weekend by weekend: price going in and fantasy points per session. */
export function ResultsTable({ rows }: { rows: RaceResultRow[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4 shadow-xs ring-1 ring-grid-line">
      <h2
        id="results-title"
        className="text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
      >
        Results
      </h2>
      <Table aria-labelledby="results-title">
        <TableHeader>
          <TableRow>
            <TableHead className="bg-surface-2">Race</TableHead>
            <TableHead className="bg-surface-2 text-right">Price</TableHead>
            <TableHead className="bg-surface-2 text-right">Qualifying</TableHead>
            <TableHead className="bg-surface-2 text-right">Sprint</TableHead>
            <TableHead className="bg-surface-2 text-right">Race</TableHead>
            <TableHead className="bg-surface-2 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.raceNumber} className="border-grid-line">
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="w-7 font-mono text-xs text-muted-foreground">
                    R{r.raceNumber}
                  </span>
                  <CountryFlag country={r.country} />
                  {r.gpName ?? `Race ${r.raceNumber}`}
                </span>
              </TableCell>
              <NumCell className="text-muted-foreground">
                {formatPriceTenths(r.priceTenths)}
              </NumCell>
              <NumCell>{formatPoints(r.quali)}</NumCell>
              <NumCell>{formatPoints(r.sprint)}</NumCell>
              <NumCell>{formatPoints(r.race)}</NumCell>
              <NumCell className="font-semibold">
                {r.total === null ? (
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    Upcoming
                  </span>
                ) : (
                  r.total
                )}
              </NumCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
