// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AppSidebar,
  MobileTopBar,
  ModeToggle,
} from "@/app/_components/app-sidebar"
import { ThemeProvider } from "@/app/_components/theme-provider"
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

describe("AppSidebar", () => {
  it("renders brand + Advisor/Stats links with the active route marked", () => {
    pathnameMock = "/stats"
    render(<AppSidebar />)

    expect(
      screen.getByRole("link", {
        name: "Fantasy F1 Race-Weekend Advisor — home",
      })
    ).toHaveAttribute("href", "/")

    const advisor = screen.getByRole("link", { name: "Advisor" })
    const stats = screen.getByRole("link", { name: "Stats" })
    expect(advisor).toHaveAttribute("href", "/")
    expect(stats).toHaveAttribute("href", "/stats")
    expect(stats).toHaveAttribute("aria-current", "page")
    expect(advisor).not.toHaveAttribute("aria-current")
  })
})

describe("MobileTopBar", () => {
  it("renders the same primary nav with active state on the advisor route", () => {
    render(<MobileTopBar />)

    const advisor = screen.getByRole("link", { name: "Advisor" })
    expect(advisor).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Stats" })).not.toHaveAttribute(
      "aria-current"
    )
  })
})

describe("ModeToggle", () => {
  it("flips the html class dark→light→dark and persists the choice", async () => {
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
