import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stats",
}

// Plain sync RSC for now — the sortable 33-asset explorer arrives in M3.
export default function StatsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stats explorer</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Prices, points, PPM, form and per-session splits for all 22 drivers and
        11 constructors. Coming in M3.
      </p>
    </main>
  )
}
