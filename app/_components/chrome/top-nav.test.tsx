import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ThemeProvider } from "@/app/_components/chrome/theme-provider"
import { ModeToggle, TopNav } from "@/app/_components/chrome/top-nav"

import { installMatchMediaStub } from "@/test/stubs/dom"

// next-themes reads prefers-color-scheme via matchMedia on mount.
installMatchMediaStub()

// usePathname drives the active state; mutable so each test can set the route.
let pathnameMock = "/"
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
}))

beforeEach(() => {
  pathnameMock = "/"
})

afterEach(() => {
  cleanup()
  // next-themes persists under the `theme` key and mutates the html class —
  // reset both so tests stay order-independent.
  window.localStorage.clear()
  document.documentElement.classList.remove("light", "dark")
})

describe("TopNav", () => {
  it("renders only the labelled Advisor/Stats tabs, with the active route marked", () => {
    pathnameMock = "/stats"
    render(<TopNav />)

    expect(screen.getAllByRole("link")).toHaveLength(2)
    const advisor = screen.getByRole("link", { name: "Advisor" })
    const stats = screen.getByRole("link", { name: "Stats" })
    expect(advisor).toHaveAttribute("href", "/")
    expect(stats).toHaveAttribute("href", "/stats")
    expect(stats).toHaveAttribute("aria-current", "page")
    expect(advisor).not.toHaveAttribute("aria-current")
  })

  it("marks the advisor tab on the home route", () => {
    render(<TopNav />)

    expect(screen.getByRole("link", { name: "Advisor" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Stats" })).not.toHaveAttribute("aria-current")
  })

  it("marks Stats as the current section on a driver profile", () => {
    pathnameMock = "/drivers/131"
    render(<TopNav />)

    expect(screen.getByRole("link", { name: "Stats" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("link", { name: "Advisor" })).not.toHaveAttribute("aria-current")
  })
})

describe("ModeToggle", () => {
  it("flips the html class light→dark→light and persists the choice", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ModeToggle />
      </ThemeProvider>
    )

    const toggle = screen.getByRole("button", { name: "Toggle theme" })
    // Light is the product default (no system preference).
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    await user.click(toggle)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(window.localStorage.getItem("theme")).toBe("dark")

    await user.click(toggle)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(window.localStorage.getItem("theme")).toBe("light")
  })
})
