import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BottomTabNav } from "@/app/_components/bottom-tab-nav"

afterEach(cleanup)

describe("BottomTabNav", () => {
  it("renders Advice/Team buttons with aria-pressed and Stats as a /stats link", () => {
    render(<BottomTabNav active="advice" onSelect={vi.fn()} />)

    const advice = screen.getByRole("button", { name: "Advice" })
    const team = screen.getByRole("button", { name: "Team" })
    expect(advice).toHaveAttribute("aria-pressed", "true")
    expect(team).toHaveAttribute("aria-pressed", "false")

    const stats = screen.getByRole("link", { name: "Stats" })
    expect(stats).toHaveAttribute("href", "/stats")
  })

  it("calls onSelect('team') when the Team tab is clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<BottomTabNav active="advice" onSelect={onSelect} />)

    await user.click(screen.getByRole("button", { name: "Team" }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("team")
  })

  it("the bar is hidden at lg and carries the safe-area inset padding", () => {
    render(<BottomTabNav active="advice" onSelect={vi.fn()} />)
    const bar = screen.getByRole("navigation", { name: "Sections" })
    expect(bar.className).toContain("lg:hidden")
    expect(bar.className).toContain("pb-[env(safe-area-inset-bottom)]")
  })

  it("active styling (text-accent-f1) lands only on the active tab", () => {
    render(<BottomTabNav active="team" onSelect={vi.fn()} />)
    const advice = screen.getByRole("button", { name: "Advice" })
    const team = screen.getByRole("button", { name: "Team" })

    expect(team.className).toContain("text-accent-f1")
    expect(team.className).not.toContain("text-muted-foreground")
    expect(advice.className).toContain("text-muted-foreground")
    expect(advice.className).not.toContain("text-accent-f1")
  })
})
