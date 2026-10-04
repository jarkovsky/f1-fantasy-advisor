/**
 * Feed plumbing for the official F1 Fantasy CDN feeds.
 *
 * Kept separate from lib/constants.ts (game rules): the vendor changes their
 * feed; the rules change with FIA regs — different change-axes.
 *
 * Terminology note: the feed numbers each race week with a "GamedayId"
 * (1..22). In OUR domain that number is always called a race / raceNumber;
 * the feed's own field names appear only inside the raw zod schemas.
 *
 * All facts verified live 2026-06-05: unauthenticated CloudFront/S3 JSON,
 * no Cache-Control headers (we own every TTL), unpublished paths return 403.
 */

/** Env override enables tests and the offline-build proof (point at an unroutable host). */
export const F1_FEED_BASE = process.env.F1_FEED_BASE ?? "https://fantasy.formula1.com/feeds"

export const feedPaths = {
  /** Per-race assets feed (the feed's own URL numbering). */
  drivers: (race: number) => `/drivers/${race}_en.json`,
  constraints: () => `/limits/constraints.json`,
  raceday: () => `/schedule/raceday_en.json`,
  mixapi: () => `/live/mixapi.json`,
} as const

/** Polite identifying UA — plain requests work, but be a good citizen. */
export const FEED_UA = "FantasyF1Advisor/0.1 (portfolio project)"

export const FEED_TIMEOUT_MS = 8_000

/** Race status enum (mirrors the raceday feed's GDStatus values). */
export const RACE_STATUS = { UPCOMING: 0, CURRENT: 1, COMPLETED: 4 } as const

/**
 * The complete session label set in the feed. Sprint weekends have all three;
 * normal weekends have Qualifying + Race. There is no distinct "Sprint" label.
 */
export const SESSION_LABELS = ["Qualifying", "Race", "Sprint Qualifying"] as const
export const SPRINT_LABEL = "Sprint Qualifying" as const

/** Unpublished races return 403 (S3 deny-on-missing-key), NOT 404. */
export const FEED_NOT_PUBLISHED_STATUS = 403

/** TREndGamedayId from the constraints feed — the 2026 season has 22 races. */
export const SEASON_END_RACE = 22
