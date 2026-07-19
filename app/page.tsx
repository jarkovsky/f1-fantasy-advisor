import { Badge } from "@/components/ui/badge"

// Plain sync RSC for now — the feed-backed advisor arrives in M1.
export default function AdvisorPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Race-Weekend Advisor
        </h1>
        <Badge variant="secondary">M0 shell</Badge>
      </header>
      <p className="max-w-prose text-sm text-muted-foreground">
        Enter your F1 Fantasy team and get the mathematically optimal transfers
        and DRS Boost pick for the upcoming Grand Prix — with the reasoning
        shown. Coming up: data layer (M1), projection engine and optimizer (M2),
        the full advisor UI (M3).
      </p>
    </main>
  )
}
