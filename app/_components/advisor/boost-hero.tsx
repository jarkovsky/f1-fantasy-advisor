import type { DriverProfile } from "@/lib/profile/types/profile"

import Link from "next/link"

import { BOOST_MULTIPLIER } from "@/lib/constants"
import { formatSignedPoints } from "@/lib/format"

import { DriverHero } from "@/app/_components/driver/driver-hero"

/**
 * The advisor's headline: the driver hero for the recommended plan's Boost
 * pick (the optimizer's Boost driver), with the boost it is worth. It follows
 * result.best.boostDriverId, like the team card's Boost badge, so the two never
 * disagree.
 */
export function BoostHero({
  profile,
  projected,
}: {
  profile: DriverProfile
  /** The pick's projected race-week points before the boost. */
  projected: number
}) {
  const boost = projected * (BOOST_MULTIPLIER - 1)
  return (
    <DriverHero
      profile={profile}
      badge={
        <p className="flex flex-col items-end gap-1">
          <span className="rounded-sm bg-warn px-2 py-1 font-display text-xs leading-none font-extrabold tracking-wide text-surface-0 uppercase [font-stretch:80%]">
            x{BOOST_MULTIPLIER} Boost
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatSignedPoints(boost)} pts boosted
          </span>
        </p>
      }
      action={
        <Link
          href={`/drivers/${profile.playerId}`}
          className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Driver profile →
        </Link>
      }
    />
  )
}
