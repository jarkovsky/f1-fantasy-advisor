/**
 * Server-only loader for the driver profile route: the current feed, the
 * season history and the schedule, assembled into every active driver's hero
 * view model. Every fetcher underneath is 'use cache', so a profile page
 * prerenders like the rest of the app and degrades to the committed snapshots.
 */
import "server-only"

import type { SeasonHistory } from "@/lib/f1/types/history"
import type { DriverProfile } from "./types/profile"
import type { RaceWeekend } from "@/lib/f1/schemas"

import { getConstraints, getDrivers, getHistory, getRaceday } from "@/lib/f1/feed"
import { carNumber, headshotPath } from "@/lib/headshots"
import { teamLogo } from "@/lib/team-logos"

import { buildDriverProfiles } from "./build-profiles"

export type ProfileSeason = {
  profiles: Record<string, DriverProfile>
  history: SeasonHistory
  weekends: RaceWeekend[]
}

export async function loadProfiles(): Promise<ProfileSeason> {
  const constraints = await getConstraints()
  // The cached fetchers key on primitive args, so resolve the race numbers first.
  const race = constraints.data?.raceNumber ?? 1
  const lastCompleted = constraints.data?.lastCompletedRace ?? 0
  const [feed, history, raceday] = await Promise.all([
    getDrivers(race, race <= lastCompleted),
    getHistory(race, lastCompleted),
    getRaceday(),
  ])
  return {
    profiles: buildDriverProfiles(feed.data, history.data, (d) => ({
      headshotPath: headshotPath(d.playerId),
      carNumber: carNumber(d.playerId),
      teamLogo: teamLogo(d.constructorId),
    })),
    history: history.data,
    weekends: raceday.data,
  }
}
