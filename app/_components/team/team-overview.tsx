"use client"

import type { TeamStateV2 } from "@/lib/team/types/team-state"
import type { AssetLite } from "@/lib/asset-lite"

import { Pencil } from "lucide-react"
import Image from "next/image"

import { assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"

import { Button } from "@/components/ui/button"

type TeamOverviewProps = {
  lineup: string[]
  assetsById: Record<string, AssetLite>
  /** Projected race-week points per asset under the active model. */
  totals: Record<string, number>
  remainingCostCapTenths: number
  freeTransfers: TeamStateV2["freeTransfers"]
  onEdit: () => void
}

function Portrait({ asset, color }: { asset: AssetLite; color: string }) {
  const ring = { background: `color-mix(in oklab, ${color} 22%, transparent)` }
  if (asset.kind === "driver" && asset.headshotPath) {
    return (
      <span className="relative size-14 overflow-hidden rounded-full" style={ring}>
        <Image
          src={asset.headshotPath}
          alt=""
          fill
          sizes="56px"
          className="scale-125 object-cover object-top pt-1"
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-14 items-center justify-center rounded-full font-display text-sm font-extrabold text-muted-foreground [font-stretch:80%]"
      style={{ ...ring, boxShadow: `inset 0 0 0 3px ${color}` }}
    >
      {asset.tla}
    </span>
  )
}

function Tile({ asset, projected }: { asset: AssetLite; projected: number }) {
  const color = teamColor(assetColorKey(asset))
  return (
    <li className="relative flex flex-col items-center gap-1 overflow-hidden rounded-lg bg-surface-2 px-1 pt-3 pb-2 text-center">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: color }}
      />
      <Portrait asset={asset} color={color} />
      <span className="font-display text-sm leading-none font-extrabold uppercase [font-stretch:80%]">
        <span aria-hidden="true">{asset.tla}</span>
        <span className="sr-only">{asset.displayName}</span>
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {formatPriceTenths(asset.priceTenths)}
      </span>
      <span className="font-mono text-xs">
        {projected.toFixed(1)}
        <span className="text-muted-foreground"> pts</span>
      </span>
    </li>
  )
}

/**
 * "Your team" at a glance: the seven picks the user saved (drivers by price,
 * then constructors) with team value, Remaining Cost Cap, and free transfers, and the Edit
 * team entry point. It shows the team as it is; the recommendation card
 * below shows what to change.
 */
export function TeamOverview({
  lineup,
  assetsById,
  totals,
  remainingCostCapTenths,
  freeTransfers,
  onEdit,
}: TeamOverviewProps) {
  const picks = lineup
    .map((id) => assetsById[id])
    .filter((a): a is AssetLite => a !== undefined)
    .sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === "driver" ? -1 : 1) || b.priceTenths - a.priceTenths
    )
  const valueTenths = picks.reduce((sum, a) => sum + a.priceTenths, 0)
  const missing = lineup.length - picks.length

  return (
    <section
      aria-labelledby="team-overview-title"
      className="flex flex-col gap-4 rounded-xl bg-surface-1 p-5 shadow-xs ring-1 ring-grid-line"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="team-overview-title" className="text-base font-semibold">
            Your team
          </h2>
          <p className="text-xs text-muted-foreground">
            Team value{" "}
            <span className="font-mono text-foreground">{formatPriceTenths(valueTenths)}</span>
            {" · "}Remaining Cost Cap{" "}
            <span className="font-mono text-foreground">
              {formatPriceTenths(remainingCostCapTenths)}
            </span>
            {" · "}
            {freeTransfers === "unlimited" ? (
              "Unlimited transfers"
            ) : (
              <>
                <span className="font-mono text-foreground">{freeTransfers}</span> free transfers
              </>
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil data-icon="inline-start" aria-hidden="true" />
          Edit team
        </Button>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {picks.map((a) => (
          <Tile key={a.playerId} asset={a} projected={totals[a.playerId] ?? 0} />
        ))}
      </ul>

      {missing > 0 && (
        <p className="text-xs text-warn">
          {missing} pick{missing === 1 ? " is" : "s are"} no longer in the race feed. Edit your team
          to replace {missing === 1 ? "it" : "them"}.
        </p>
      )}
    </section>
  )
}
