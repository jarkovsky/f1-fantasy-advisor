import type { DriverProfile } from "@/lib/profile/types/profile"

import Image from "next/image"

import { formatOrdinal, formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

import { SentimentMeter } from "./sentiment-meter"
import { RatingPips } from "./rating-pips"
import { PriceMove } from "./price-move"

type DriverHeroProps = {
  profile: DriverProfile
  /** h1 on the profile page; h2 in the advisor, whose page hero owns the h1. */
  headingLevel?: "h1" | "h2"
  /** Top-right callout (the advisor's Boost pill). */
  badge?: React.ReactNode
  /** Trailing link under the name (the advisor's "Driver profile" link). */
  action?: React.ReactNode
  className?: string
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  )
}

function StripCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex h-5 items-center font-mono text-sm">{children}</dd>
    </div>
  )
}

/**
 * The driver profile hero: a carbon panel lit in the team color, the headshot
 * cutout, the outlined car number, a light first name over a heavy surname,
 * and a glass strip of fantasy signals (session ratings, price and its moves,
 * selection sentiment).
 *
 * Always dark, whatever the page theme: the `dark` class re-scopes every token
 * inside, so text/surface pairs stay the ones designed for the carbon theme.
 * No hooks, so it renders on the server (profile page) and inside the
 * advisor's client island alike.
 */
export function DriverHero({
  profile,
  headingLevel: Heading = "h2",
  badge,
  action,
  className,
}: DriverHeroProps) {
  const headingId = `driver-hero-${profile.playerId}`
  const color = teamColor(profile.constructorId)

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "dark @container relative isolate overflow-hidden rounded-2xl bg-surface-0 text-foreground shadow-lg ring-1 ring-grid-line-strong",
        className
      )}
      style={{ "--team": color } as React.CSSProperties}
    >
      {/* Team-colored light behind the driver, falling off to carbon. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(65%_85%_at_16%_60%,color-mix(in_oklab,var(--team)_42%,transparent),transparent_72%)]"
      />
      {profile.carNumber !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[0.18em] -right-[0.04em] -z-10 font-display text-[42cqi] leading-none font-black text-transparent [font-stretch:125%] select-none [-webkit-text-stroke:2px_oklch(1_0_0/0.13)] @3xl:text-[30cqi]"
        >
          {profile.carNumber}
        </span>
      )}

      {badge && <div className="absolute top-4 right-4 z-10 @3xl:top-6 @3xl:right-6">{badge}</div>}

      <div className="grid grid-cols-[34cqi_1fr] items-end gap-x-3 px-4 pt-12 @lg:px-6 @3xl:grid-cols-[15rem_1fr] @3xl:gap-x-8 @3xl:px-8 @3xl:pt-10">
        <div className="relative aspect-square self-end">
          <div
            aria-hidden="true"
            className="absolute inset-[4%] rounded-full border border-grid-line-strong"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[22%] rounded-full bg-(--team) opacity-35 blur-3xl"
          />
          {profile.headshotPath ? (
            <Image
              src={profile.headshotPath}
              alt=""
              fill
              sizes="(min-width: 768px) 15rem, 34vw"
              // The hero sits above the fold wherever it renders and its
              // headshot is the LCP element.
              loading="eager"
              className="object-contain object-bottom drop-shadow-[0_18px_28px_oklch(0_0_0/0.55)]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-[18%] flex items-center justify-center rounded-full bg-surface-2 font-display text-[10cqi] font-extrabold text-muted-foreground [font-stretch:125%]"
            >
              {profile.tla}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 pb-5 @3xl:pb-7">
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="h-3 w-[3px] rounded-full bg-(--team)" />
            {profile.teamName ?? "—"}
            {profile.carNumber !== null && (
              <span className="text-foreground/80">· No. {profile.carNumber}</span>
            )}
          </p>
          <Heading id={headingId} className="font-display leading-[0.92]">
            <span className="block text-[7cqi] font-light [font-stretch:110%] @3xl:text-[4.6cqi]">
              {profile.firstName}
            </span>{" "}
            <span className="block text-[8.6cqi] font-extrabold tracking-tight wrap-anywhere [font-stretch:125%] @3xl:text-[6.2cqi]">
              {profile.lastName}
            </span>
          </Heading>
          <dl className="hidden grid-cols-2 gap-x-5 gap-y-3 @lg:grid @3xl:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
            <Meta label="Born">{profile.birthplace ?? "—"}</Meta>
            <Meta label="Season">
              <span className="font-mono">{profile.seasonPoints}</span> pts
            </Meta>
            <Meta label="Rank">
              {formatOrdinal(profile.seasonRank)}{" "}
              <span className="text-muted-foreground">of {profile.gridSize}</span>
            </Meta>
            <Meta label="Boosted by">
              <span className="font-mono">{profile.boostedPercent}%</span>
            </Meta>
          </dl>
          {action}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-4 border-t border-grid-line-strong bg-surface-1/70 px-4 py-4 backdrop-blur @lg:px-6 @3xl:grid-cols-6 @3xl:px-8">
        <StripCell label="Qualifying">
          <RatingPips rating={profile.quali} session="qualifying" />
        </StripCell>
        <StripCell label="Race">
          <RatingPips rating={profile.race} session="race" />
        </StripCell>
        <StripCell label="Price">{formatPriceTenths(profile.priceTenths)}</StripCell>
        <StripCell label="Season">
          <PriceMove tenths={profile.seasonPriceDeltaTenths} />
        </StripCell>
        <StripCell label="Last race">
          <PriceMove tenths={profile.lastPriceDeltaTenths} />
        </StripCell>
        <StripCell label="Sentiment">
          <SentimentMeter sentiment={profile.sentiment} />
        </StripCell>
      </dl>
    </section>
  )
}
