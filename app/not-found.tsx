import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        Nothing here — maybe a pit-lane wrong turn.
      </p>
      <Button asChild>
        <Link href="/">Back to the advisor</Link>
      </Button>
    </main>
  )
}
