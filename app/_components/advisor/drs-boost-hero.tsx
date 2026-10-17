import type { DriverProfile } from "@/lib/profile/types/profile"

import Link from "next/link"

import { DRS_BOOST_MULTIPLIER } from "@/lib/constants"
import { formatSignedPoints } from "@/lib/format"

import { DriverHero } from "@/app/_components/driver/driver-hero"

/**
 * The advisor's headline: the driver hero for the recommended plan's DRS Boost
 * pick (the optimizer's captain), with the boost it is worth. It follows
 * result.best.captainId, like the team card's DRS chip, so the two never
 * disagree.
 */
export function DrsBoostHero({
  profile,
  projected,
}: {
  profile: DriverProfile
  /** The pick's projected race-week points before the boost. */
  projected: number
}) {
  const boost = projected * (DRS_BOOST_MULTIPLIER - 1)
  return (
    <DriverHero
      profile={profile}
      badge={
        <p className="flex flex-col items-end gap-1">
          <span className="rounded-sm bg-warn px-2 py-1 font-display text-xs leading-none font-extrabold tracking-wide text-surface-0 uppercase [font-stretch:80%]">
            DRS Boost ×{DRS_BOOST_MULTIPLIER}
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
