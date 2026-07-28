import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Next 16 Cache Components: everything is dynamic by default; caching is
  // explicit via 'use cache' + cacheLife(). Implies PPR (static shell +
  // streamed Suspense holes) — the rendering model this app is built around.
  cacheComponents: true,
  // Type-safe <Link href> / router.push. Route types are emitted by
  // `next typegen` (wired into the typecheck script).
  typedRoutes: true,
  // TTLs for the F1 feed fetchers (the feeds send no Cache-Control — we own
  // freshness). All revalidate ≥ 5 min so cached feeds stay in the prerender
  // (shorter lifetimes are auto-demoted to dynamic holes).
  // NOTE: declaring custom profiles makes the generated cacheLife() types
  // accept ONLY these names — so every profile we use is declared here.
  cacheLife: {
    // completed races are immutable — effectively forever (the 'max' preset)
    driversCompleted: { stale: 300, revalidate: 2592000, expire: 31536000 },
    // current-race drivers feed + history aggregate
    driversCurrent: { stale: 300, revalidate: 300, expire: 3600 },
    // constraints.json — the "which race is it" pointer
    orchestration: { stale: 300, revalidate: 300, expire: 3600 },
    // raceday schedule — session times move on the timescale of hours
    raceday: { stale: 300, revalidate: 3600, expire: 86400 },
    // mixapi live/maintenance flags (the 'minutes' preset values)
    mixapi: { stale: 300, revalidate: 60, expire: 3600 },
  },
}

export default nextConfig
