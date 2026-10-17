import type { DriverProfile } from "@/lib/profile/types/profile"
import type { HeadToHead } from "@/lib/profile/race-results"

import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { teamColor } from "@/lib/team-colors"

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * The teammate duel: who outscored whom, weekend by weekend, plus the
 * teammate's season line. Links through to the teammate's own profile.
 */
export function HeadToHeadCard({
  driver,
  teammate,
  duel,
}: {
  driver: DriverProfile
  teammate: DriverProfile
  /** From the profiled driver's side: `ahead` = weekends they outscored the teammate. */
  duel: HeadToHead
}) {
  const avg = teammate.scoredRaces > 0 ? teammate.seasonPoints / teammate.scoredRaces : null
  return (
    <section
      className="relative isolate flex flex-col gap-3 overflow-hidden rounded-xl bg-surface-1 p-4 shadow-xs ring-1 ring-grid-line"
      style={{ "--team": teamColor(teammate.constructorId) } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Head to head
        </h2>
        <Link
          href={`/drivers/${teammate.playerId}`}
          aria-label={`${teammate.firstName} ${teammate.lastName} profile`}
          className="rounded-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <p className="font-display leading-none">
        <span className="block text-lg font-light [font-stretch:110%]">{teammate.firstName}</span>
        <span className="block text-xl font-extrabold [font-stretch:125%]">
          {teammate.lastName}
        </span>
      </p>
      <dl className="grid w-3/5 grid-cols-2 gap-x-3 gap-y-2">
        <Stat label="Points">{teammate.seasonPoints}</Stat>
        <Stat label="Avg pts">{avg === null ? "—" : avg.toFixed(1)}</Stat>
      </dl>
      <div className="flex w-3/5 flex-col gap-0.5">
        <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Weekends ahead
        </p>
        <p className="font-mono text-sm tabular-nums">
          {driver.tla} {duel.ahead}–{duel.behind} {teammate.tla}
        </p>
        <p className="text-xs text-muted-foreground">
          By fantasy points over {duel.races} shared race{duel.races === 1 ? "" : "s"}; ties count
          for neither.
        </p>
      </div>
      {teammate.headshotPath && (
        <div aria-hidden="true" className="absolute right-0 bottom-0 -z-10 size-36">
          <div className="absolute inset-[18%] rounded-full bg-(--team) opacity-25 blur-2xl" />
          <Image
            src={teammate.headshotPath}
            alt=""
            fill
            sizes="144px"
            className="object-contain object-bottom"
          />
        </div>
      )}
    </section>
  )
}
