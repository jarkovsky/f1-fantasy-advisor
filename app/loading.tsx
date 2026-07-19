export default function Loading() {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-full max-w-prose animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-2/3 max-w-prose animate-pulse rounded-md bg-muted" />
    </main>
  )
}
