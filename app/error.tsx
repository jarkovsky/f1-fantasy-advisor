"use client"

import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        {error.digest ? `Error digest: ${error.digest}` : error.message}
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
