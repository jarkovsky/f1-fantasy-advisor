import type { StatsRow } from "./stats-row"

import Link from "next/link"

import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { TableCell, TableRow } from "@/components/ui/table"

import { TeamColorBar } from "@/app/_components/shared/team-color-bar"
import { NumCell } from "@/app/_components/shared/num-cell"
import { Delta } from "@/app/_components/shared/delta"

import { Sparkline } from "./sparkline"

/** One-decimal numeric, em dash for null. */
function fmt1(v: number | null): string {
  return v === null ? "—" : v.toFixed(1)
}

export function DataRow({ row }: { row: StatsRow }) {
  return (
    <TableRow className="border-grid-line">
      <TableCell>
        <div className="flex items-center gap-2">
          <TeamColorBar color={teamColor(row.colorKey)} className="h-5" />
          <span className="font-mono text-xs font-semibold">{row.tla}</span>
          {row.hasProfile ? (
            <Link
              href={`/drivers/${row.playerId}`}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {row.displayName}
            </Link>
          ) : (
            <span className="text-muted-foreground">{row.displayName}</span>
          )}
        </div>
      </TableCell>
      <NumCell>{formatPriceTenths(row.priceTenths)}</NumCell>
      <NumCell>
        <Delta value={row.priceDeltaTenths} tenths />
      </NumCell>
      <NumCell>{row.seasonPoints}</NumCell>
      <NumCell>{fmt1(row.ppm)}</NumCell>
      <NumCell>{fmt1(row.form5)}</NumCell>
      <NumCell>{fmt1(row.qualiAvg)}</NumCell>
      <NumCell>{fmt1(row.raceAvg)}</NumCell>
      <NumCell>{fmt1(row.sprintAvg)}</NumCell>
      <NumCell>{row.selectedPercent}%</NumCell>
      <NumCell>{row.captainSelectedPercent}%</NumCell>
      <TableCell className="text-right">
        <span className="inline-flex justify-end">
          <Sparkline series={row.spark} />
        </span>
      </TableCell>
    </TableRow>
  )
}
