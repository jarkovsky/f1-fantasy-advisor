import type { AssetProjection } from "@/lib/projections/types/projection"
import type { DriverProfile } from "@/lib/profile/types/profile"

import Image from "next/image"
import Link from "next/link"

import { formatPriceTenths, formatSignedPoints } from "@/lib/format"
import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { splitFullName } from "@/lib/profile/build-profiles"
import { PRESET_REGISTRY } from "@/lib/projections/engine"
import { BOOST_MULTIPLIER } from "@/lib/constants"
import { SPRINT_LABEL } from "@/lib/f1/config"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

import { RatingPips } from "@/app/_components/driver/rating-pips"
import { TapTooltip } from "@/app/_components/shared/info-tip"

/** A pick's role in the comparison: unchanged, leaving the team, or joining it. */
export type PickStatus = "kept" | "out" | "in"

/**
 * The team's logo: the full-color mark on light surfaces, the white mark in
 * the dark theme and on carbon (both rendered; `dark:` swaps them, so there is
 * no theme read and no hydration mismatch). Falls back to the TLA.
 */
export function TeamMark({
  asset,
  className,
  onCarbon = false,
}: {
  asset: Pick<AssetLite, "logo" | "tla">
  className?: string
  /** Always the white mark (the featured card's carbon panel). */
  onCarbon?: boolean
}) {
  if (!asset.logo) {
    return (
      <span className={cn("font-display text-xs font-extrabold [font-stretch:80%]", className)}>
        {asset.tla}
      </span>
    )
  }
  return (
    <span className={cn("relative block", className)}>
      {!onCarbon && (
        <Image
          src={asset.logo.color}
          alt=""
          fill
          sizes="64px"
          className="object-contain dark:hidden"
        />
      )}
      <Image
        src={asset.logo.white}
        alt=""
        fill
        sizes="64px"
        className={cn("object-contain", !onCarbon && "hidden dark:block")}
      />
    </span>
  )
}

/** The "x2 Boost" pill — the game's own label for the doubled driver. */
export function BoostBadge({
  className,
  collapse = false,
}: {
  className?: string
  /** Drop the word "Boost" in a narrow container (under 11rem), leaving "x2". */
  collapse?: boolean
}) {
  return (
    <span
      aria-label={`x${BOOST_MULTIPLIER} Boost driver`}
      title={`x${BOOST_MULTIPLIER} Boost driver`}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-[0.3em] rounded-sm bg-flag-yellow px-1.5 font-display text-[11px] leading-none font-extrabold text-flag-yellow-foreground [font-stretch:80%]",
        className
      )}
    >
      x{BOOST_MULTIPLIER} <span className={cn(collapse && "hidden @[11rem]:inline")}>Boost</span>
    </span>
  )
}

function StatusTag({ status }: { status: PickStatus }) {
  if (status === "kept") return null
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-sm px-1 text-[10px] leading-none font-bold tracking-wide uppercase",
        status === "in" ? "bg-pos text-background" : "bg-neg text-background"
      )}
    >
      {status === "in" ? "In" : "Out"}
    </span>
  )
}

/**
 * What a pick's numbers mean: its projected points for this race week, split
 * by session, the model they come from, and its price. The pick's own
 * projection says which model applied (a pick with no results yet falls back
 * to Equal PPM, whatever the selected model).
 */
function NumbersTip({
  asset,
  projected,
  projection,
  boost,
}: {
  asset: AssetLite
  projected: number
  projection: AssetProjection | undefined
  boost: boolean
}) {
  const model = PRESET_REGISTRY.find((def) => def.id === projection?.source)
  const sessions = (projection?.perSession ?? [])
    .map((s) => `${s.session === SPRINT_LABEL ? "Sprint" : s.session} ${s.expected.toFixed(1)}`)
    .join(" + ")
  return (
    <span className="flex flex-col gap-1.5">
      <span>
        <span className="font-semibold">{projected.toFixed(1)} projected points</span> this race
        week
        {boost &&
          `, ${(projected * BOOST_MULTIPLIER).toFixed(1)} with the x${BOOST_MULTIPLIER} Boost`}
        .
      </span>
      {!asset.active ? (
        <span>Inactive: this entry no longer races, so it projects 0.</span>
      ) : (
        <>
          {sessions && <span className="font-mono">{sessions}</span>}
          {projection?.fallback === "equal-ppm-no-history" ? (
            <span>No results yet this season, so this comes from its price (Equal PPM).</span>
          ) : (
            model && (
              <span>
                From the {model.label} model. {model.description}
              </span>
            )
          )}
        </>
      )}
      <span>Price {formatPriceTenths(asset.priceTenths)}.</span>
    </span>
  )
}

function Portrait({ asset, color }: { asset: AssetLite; color: string }) {
  const tint = { background: `color-mix(in oklab, ${color} 22%, transparent)` }
  if (asset.kind === "driver" && asset.headshotPath) {
    return (
      <span
        className="relative block size-8 shrink-0 overflow-hidden rounded-full @[13rem]:size-10"
        style={tint}
      >
        <Image
          src={asset.headshotPath}
          alt=""
          fill
          sizes="40px"
          className="scale-125 object-cover object-top pt-0.5"
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full p-1.5 @[13rem]:size-10 @[13rem]:p-2"
      style={{ ...tint, boxShadow: `inset 0 0 0 2px ${color}` }}
    >
      <TeamMark asset={asset} className="size-full" />
    </span>
  )
}

/** The props every pick takes, in either form. */
type PickProps = {
  asset: AssetLite | undefined
  id: string
  projected: number
  /** The pick's projection under the selected model, explained in its numbers' tooltip. */
  projection: AssetProjection | undefined
  status: PickStatus
  boost: boolean
}

/**
 * One compact pick in a comparison column: portrait, TLA, name, projected
 * points and price, tinted by status (green joining, red leaving). The name
 * carries the status in text style too (struck through when leaving), and the
 * IN/OUT tag says it in words, so color is never the only signal. The numbers
 * are a tooltip trigger that says what they are and where they come from.
 */
export function PickRow({ asset, id, projected, projection, status, boost }: PickProps) {
  if (!asset) {
    return (
      <li className="flex h-full items-center rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-muted-foreground">
        Asset {id} — no longer in the race feed
      </li>
    )
  }
  const color = teamColor(assetColorKey(asset))
  return (
    <li
      className={cn(
        "@container flex h-full items-center rounded-lg px-2 py-2 sm:px-2.5",
        status === "in" ? "bg-pos-quiet" : status === "out" ? "bg-neg-quiet" : "bg-surface-2"
      )}
    >
      {/* One grid, two arrangements (container query on the row): narrow
          columns stack TLA over points; wide ones add the name and put the
          points and price at the end. Each value renders once. */}
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 @[13rem]:grid-cols-[auto_minmax(0,1fr)_auto] @[13rem]:gap-x-2.5">
        <div className="row-span-2">
          <Portrait asset={asset} color={color} />
        </div>
        <p className="flex min-w-0 items-center gap-1.5 self-end">
          <span className="font-display text-sm leading-none font-extrabold uppercase [font-stretch:80%]">
            {asset.tla}
          </span>
          <StatusTag status={status} />
          {!asset.active && (
            <span className="hidden text-[10px] font-semibold tracking-wide text-muted-foreground uppercase @[13rem]:inline">
              Inactive
            </span>
          )}
          {boost && <BoostBadge collapse />}
        </p>
        <p
          className={cn(
            "col-start-2 row-start-2 hidden self-start truncate text-xs @[13rem]:block",
            status === "out" && "text-muted-foreground line-through",
            status === "in" && "font-medium",
            status === "kept" && "text-muted-foreground"
          )}
        >
          {asset.displayName}
        </p>
        <TapTooltip
          tip={
            <NumbersTip asset={asset} projected={projected} projection={projection} boost={boost} />
          }
        >
          <button
            type="button"
            aria-label={`${projected.toFixed(1)} projected points, price ${formatPriceTenths(asset.priceTenths)}`}
            className="col-start-2 row-start-2 -mx-1 flex cursor-help flex-col items-start self-start rounded-sm px-1 text-left outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-accent-f1 @[13rem]:col-start-3 @[13rem]:row-span-2 @[13rem]:row-start-1 @[13rem]:items-end @[13rem]:gap-0.5 @[13rem]:self-center @[13rem]:text-right"
          >
            <span className="font-mono text-xs tabular-nums @[13rem]:text-sm">
              {projected.toFixed(1)}
            </span>
            <span className="hidden font-mono text-[11px] text-muted-foreground tabular-nums @[13rem]:block">
              {formatPriceTenths(asset.priceTenths)}
            </span>
          </button>
        </TapTooltip>
      </div>
    </li>
  )
}

/**
 * The featured pick at the head of a column (TeamComparison picks the slot),
 * rendered as a small carbon hero (headshot, light first name over a heavy
 * surname, team mark, the session ratings). When it is the Boost driver it
 * carries the x2 Boost badge and what the Boost is worth.
 */
export function FeaturedPick({
  profile,
  ...pick
}: PickProps & {
  profile: DriverProfile | undefined
}) {
  const { asset, projected, projection, status, boost } = pick
  if (!asset) return <PickRow {...pick} />
  const color = teamColor(assetColorKey(asset))
  const split = splitFullName(asset.fullName)
  const first = profile?.firstName ?? split.first
  const last = profile?.lastName ?? split.last

  return (
    <li
      className={cn(
        "dark @container relative isolate flex h-full min-h-36 overflow-hidden rounded-lg bg-surface-0 text-foreground ring-1 ring-grid-line-strong",
        status === "in" && "ring-2 ring-pos",
        status === "out" && "ring-2 ring-neg"
      )}
      style={{ "--team": color } as React.CSSProperties}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_100%_at_18%_70%,color-mix(in_oklab,var(--team)_45%,transparent),transparent_75%)]"
      />
      {asset.headshotPath && (
        <div className="relative hidden w-[38%] shrink-0 self-end @[16rem]:block">
          <div className="relative aspect-square">
            <Image
              src={asset.headshotPath}
              alt=""
              fill
              sizes="(min-width: 1024px) 14rem, 30vw"
              className="object-contain object-bottom drop-shadow-[0_12px_20px_oklch(0_0_0/0.5)]"
            />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TeamMark asset={asset} onCarbon className="size-5" />
          <span className="truncate text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {asset.teamName}
          </span>
          <StatusTag status={status} />
        </div>
        <p className="font-display leading-[0.95]">
          <span className="block truncate text-sm font-light @[16rem]:text-lg @[16rem]:[font-stretch:110%]">
            {first}
          </span>{" "}
          <span
            className={cn(
              "block truncate text-base font-extrabold @[16rem]:text-2xl @[16rem]:[font-stretch:125%]",
              status === "out" && "line-through decoration-2"
            )}
          >
            {last}
          </span>
        </p>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <dl className="flex gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Projected
              </dt>
              <dd>
                <TapTooltip
                  tip={
                    <NumbersTip
                      asset={asset}
                      projected={projected}
                      projection={projection}
                      boost={boost}
                    />
                  }
                >
                  <button
                    type="button"
                    className="-mx-1 cursor-help rounded-sm px-1 font-mono text-sm tabular-nums outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-accent-f1"
                  >
                    {projected.toFixed(1)}
                  </button>
                </TapTooltip>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Price
              </dt>
              <dd className="font-mono text-sm tabular-nums">
                {formatPriceTenths(asset.priceTenths)}
              </dd>
            </div>
            {profile && (
              <div className="hidden flex-col gap-1 @[24rem]:flex">
                <dt className="text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Race
                </dt>
                <dd className="flex h-5 items-center">
                  <RatingPips rating={profile.race} session="race" />
                </dd>
              </div>
            )}
          </dl>
          {boost && (
            <div className="flex flex-col items-start gap-1">
              <BoostBadge />
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatSignedPoints(projected * (BOOST_MULTIPLIER - 1))} pts
              </span>
            </div>
          )}
        </div>
        {profile && (
          <Link
            href={`/drivers/${profile.playerId}`}
            className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Driver profile →
          </Link>
        )}
      </div>
    </li>
  )
}
