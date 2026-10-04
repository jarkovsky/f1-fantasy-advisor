"use client"

// Last-resort boundary: replaces the root layout, so it must render its own
// <html>/<body>. Styles are inlined — globals.css may not have loaded.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          display: "flex",
          minHeight: "100svh",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "grid", gap: 12, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went badly wrong</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>
            {error.digest ? `Error digest: ${error.digest}` : "Unexpected error."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              justifySelf: "start",
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "#fafafa",
              color: "#0a0a0a",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
