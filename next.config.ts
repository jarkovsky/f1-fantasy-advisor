import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Next 16 Cache Components: everything is dynamic by default; caching is
  // explicit via 'use cache' + cacheLife(). Implies PPR (static shell +
  // streamed Suspense holes) — the rendering model this app is built around.
  cacheComponents: true,
  // Type-safe <Link href> / router.push. Route types are emitted by
  // `next typegen` (wired into the typecheck script).
  typedRoutes: true,
}

export default nextConfig
