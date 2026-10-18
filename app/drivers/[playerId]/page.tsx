import type { Metadata } from "next"

import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { headToHead, raceResults } from "@/lib/profile/race-results"
import { loadProfiles } from "@/lib/profile/load-profiles"
import { form5 } from "@/lib/profile/season-stats"
import { formatOrdinal } from "@/lib/format"

import { StaleDataNotice } from "@/app/_components/shared/stale-data-notice"
import { DriverHero } from "@/app/_components/driver/driver-hero"

import { HeadToHeadCard } from "./_components/head-to-head-card"
import { ResultsTable } from "./_components/results-table"
import { StatCard } from "./_components/stat-card"

// Prerender every active driver. The loader degrades to committed snapshots,
// but if every feed were empty there would be no ids, and Cache Components
// rejects an empty list, so a placeholder id keeps offline builds green (it
// renders the 404).
export async function generateStaticParams() {
  const { profiles } = await loadProfiles()
  const ids = Object.keys(profiles)
  return (ids.length > 0 ? ids : ["unknown"]).map((playerId) => ({ playerId }))
}

export async function generateMetadata({
  params,
}: PageProps<"/drivers/[playerId]">): Promise<Metadata> {
  const { playerId } = await params
  const { profiles } = await loadProfiles()
  const p = profiles[playerId]
  return p ? { title: `${p.firstName} ${p.lastName}` } : {}
}

function fmt1(v: number | null): string {
  return v === null ? "—" : v.toFixed(1)
}

export default async function DriverPage({ params }: PageProps<"/drivers/[playerId]">) {
  const { playerId } = await params
  const { profiles, history, weekends, meta } = await loadProfiles()
  const profile = profiles[playerId]
  const hist = history.byPlayerId[playerId]
  if (!profile || !hist) notFound()

  // The teammate: same constructor, most season points (a seat swap leaves
  // more than one entry per team over a season).
  const teammate = Object.values(profiles)
    .filter((p) => p.constructorId === profile.constructorId && p.playerId !== playerId)
    .sort((a, b) => b.seasonPoints - a.seasonPoints)[0]
  const teammateHist = teammate ? history.byPlayerId[teammate.playerId] : undefined

  const avg = profile.scoredRaces > 0 ? profile.seasonPoints / profile.scoredRaces : null
  const ppm = profile.priceTenths > 0 ? profile.seasonPoints / (profile.priceTenths / 10) : null
  const stats = hist.latestAdditionalStats

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:py-12">
      <Link
        href="/stats"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Stats
      </Link>

      {meta.source === "snapshot" && <StaleDataNotice asOf={meta.asOf} />}

      <DriverHero profile={profile} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Overview"
          rows={[
            {
              label: "Fantasy rank",
              value: `${formatOrdinal(profile.seasonRank)} of ${profile.gridSize}`,
            },
            { label: "Average points", value: fmt1(avg) },
            { label: "Form (last 5)", value: fmt1(form5(hist)) },
            { label: "Points per $M", value: fmt1(ppm) },
            { label: "Selected by", value: `${profile.sentiment.selectedPercent}%` },
            { label: "Boosted by", value: `${profile.boostedPercent}%` },
          ]}
        />
        <StatCard
          title="Points breakdown"
          rows={
            stats
              ? [
                  { label: "Finishing positions", value: stats.totalPositionPts },
                  { label: "Positions gained/lost", value: stats.totalPositionGainedLost },
                  { label: "Overtakes", value: stats.overtakingPts },
                  { label: "Fastest laps", value: stats.fastestLapPts },
                  { label: "Driver of the Day", value: stats.dotdPts },
                  { label: "DNF / DSQ", value: stats.totalDnfDqPts },
                ]
              : [{ label: "No scored races yet", value: "—" }]
          }
        />
        {teammate && teammateHist ? (
          <HeadToHeadCard
            driver={profile}
            teammate={teammate}
            duel={headToHead(hist, teammateHist)}
          />
        ) : (
          <StatCard
            title="Head to head"
            rows={[{ label: "No teammate in the feed", value: "—" }]}
          />
        )}
      </div>

      <ResultsTable rows={raceResults(hist, weekends)} />

      <p className="text-xs text-muted-foreground">
        Ratings place the driver&apos;s average qualifying and race points within the grid, in five
        equal bands. Sentiment is the change in selection % over the last three races. Points
        breakdown is the feed&apos;s season-to-date tally.
      </p>
    </main>
  )
}
