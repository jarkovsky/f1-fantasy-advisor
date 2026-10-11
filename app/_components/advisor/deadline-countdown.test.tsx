import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import { renderToString } from "react-dom/server"

import { teamStore } from "@/lib/team/store"

import { DeadlineCountdown } from "@/app/_components/advisor/deadline-countdown"

// ---------------------------------------------------------------------------
// The component reads the wall clock via currentTimeMs(), which falls through
// to Date.now() unless localStorage["f1:devNow"] is set. We clear localStorage
// in beforeEach, so vi.useFakeTimers() + setSystemTime() fully pins the clock —
// the seeded interval ticks under vi.advanceTimersByTime, no real time passes.
// ---------------------------------------------------------------------------

// Wall clock pinned to a Saturday; the Monaco lock is the next afternoon.
const NOW = Date.parse("2026-06-06T12:00:00.000Z")

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  teamStore.__resetForTests()
})

describe("DeadlineCountdown", () => {
  it("server render emits the stable placeholder, not a live delta (hydration-safe)", () => {
    // The pre-mount contract: effects have not run, so the very first render is
    // the placeholder. renderToString exercises exactly that path — the string
    // must contain "Locks at —" and never a "Locks in …" countdown.
    const html = renderToString(<DeadlineCountdown lockAtMs={NOW + 2 * 86_400_000} />)
    expect(html).toContain("Locks at —")
    expect(html).not.toContain("Locks in")
  })

  it("after mount shows a coarse remaining-time string for a lock 2 days out", () => {
    const { container } = render(
      <DeadlineCountdown lockAtMs={NOW + 2 * 86_400_000 + 5 * 3_600_000} />
    )
    // Effects have flushed → the live delta replaced the placeholder.
    expect(container.textContent).not.toContain("Locks at —")
    expect(container.textContent).toMatch(/Locks in \d+d \d+h \d+m|\d+h \d+m/)
    expect(container.textContent).toContain("Locks in 2d 5h 0m")
  })

  it("advancing fake timers by 1s updates the seconds branch when under 1h", () => {
    const { container } = render(<DeadlineCountdown lockAtMs={NOW + 30 * 60_000} />)
    // First tick: 30m exactly → "29m 59s" once we are one second past mount? No:
    // remaining is exactly 30 * 60_000 at mount → "30m 0s".
    expect(container.textContent).toContain("Locks in 30m 0s")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container.textContent).toContain("Locks in 29m 59s")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container.textContent).toContain("Locks in 29m 58s")
  })

  it("reaching the lock freezes the text and clears the interval", () => {
    const { container } = render(<DeadlineCountdown lockAtMs={NOW + 5_000} />)
    expect(container.textContent).toContain("Locks in")
    // Advance past the lock — the interval self-clears at t >= lockAtMs.
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(container.textContent).toContain("Locked")
    expect(container.textContent).not.toContain("Locks in")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("unmount clears the interval", () => {
    const { unmount } = render(<DeadlineCountdown lockAtMs={NOW + 30 * 60_000} />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("ticking text is aria-hidden and a separate polite status region exists", () => {
    const { container } = render(<DeadlineCountdown lockAtMs={NOW + 30 * 60_000} />)
    const ticking = container.querySelector('[aria-hidden="true"]')
    expect(ticking).not.toBeNull()
    expect(ticking?.textContent).toContain("Locks in")

    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(status).toHaveAttribute("aria-live", "polite")
    // The polite region carries the coarse milestone announcement, never the
    // per-second delta — it must not be the aria-hidden ticking node.
    expect(status).not.toHaveAttribute("aria-hidden", "true")
    expect(status?.textContent).toMatch(/Lock in/)
  })
})
