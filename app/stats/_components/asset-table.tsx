import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getConstraints, getDrivers } from "@/lib/f1/feed"
import { DataAsOf } from "./data-as-of"

function price(tenths: number): string {
  return `$${(tenths / 10).toFixed(1)}M`
}

/**
 * /stats v0: the typed-feed debug table (M1 exit criterion). Async RSC —
 * the page's one streamed hole. The full sortable explorer lands in M3.
 */
export async function AssetTable() {
  const constraints = await getConstraints()
  // Resolve the race number BEFORE the cached call: primitive args only.
  const race = constraints.data?.raceNumber ?? 1
  const lastCompleted = constraints.data?.lastCompletedRace ?? 0
  const feed = await getDrivers(race, race <= lastCompleted)

  const drivers = feed.data.filter((a) => a.kind === "driver")
  const constructors = feed.data.filter((a) => a.kind === "constructor")
  const sorted = [...drivers, ...constructors].sort((a, b) =>
    a.kind === b.kind
      ? b.priceTenths - a.priceTenths
      : a.kind === "driver"
        ? -1
        : 1
  )

  return (
    <div className="flex flex-col gap-3">
      <DataAsOf meta={feed.meta} />
      <Table>
        <TableCaption>
          Race {race} · {drivers.length} drivers + {constructors.length}{" "}
          constructors · points pending until the race is scored
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Δ prev</TableHead>
            <TableHead className="text-right">Race pts</TableHead>
            <TableHead className="text-right">Selected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((asset) => {
            const delta = asset.priceTenths - asset.prevPriceTenths
            return (
              <TableRow key={asset.playerId}>
                <TableCell className="font-medium">
                  {asset.displayName}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={asset.kind === "driver" ? "secondary" : "outline"}
                  >
                    {asset.kind}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {asset.teamName ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {price(asset.priceTenths)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {delta === 0
                    ? "·"
                    : `${delta > 0 ? "+" : "−"}${Math.abs(delta) / 10}`}
                </TableCell>
                <TableCell className="text-right">
                  {asset.racePoints ?? "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {asset.selectedPercent}%
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
