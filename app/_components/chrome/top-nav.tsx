"use client"

import { Brain, ChartColumn, Flag, Moon, Sun } from "lucide-react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

// App chrome: one sticky top bar at every width — brand, the two labelled
// tabs, and the mode toggle. A client component because the active tab needs
// usePathname and the toggle needs next-themes; both are cheap and render
// outside the streamed data holes.

const NAV_ITEMS = [
  { href: "/", label: "Advisor", icon: Brain, section: [] },
  // Driver profiles are reached from the stats table, so they light up Stats.
  { href: "/stats", label: "Stats", icon: ChartColumn, section: ["/drivers/"] },
] as const

/**
 * aria-current for a nav link: "page" on its own route, "true" inside its
 * section (a driver profile under Stats), else nothing.
 */
function currentFor(
  pathname: string,
  item: (typeof NAV_ITEMS)[number]
): "page" | "true" | undefined {
  if (pathname === item.href) return "page"
  if (item.section.some((prefix) => pathname.startsWith(prefix))) return "true"
  return undefined
}

/**
 * Canonical shadcn mode toggle: both icons rendered, visibility swapped by
 * the .dark class — no mount gate, no hydration mismatch.
 */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden="true" className="size-5 dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-5 dark:block" />
    </Button>
  )
}

export function TopNav() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b border-grid-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          aria-label="Fantasy F1 Race-Weekend Advisor — home"
          className="flex items-center gap-2.5"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-f1-fill text-accent-f1-foreground">
            <Flag aria-hidden="true" className="size-4" />
          </span>
          <span className="hidden font-display text-base leading-none font-extrabold tracking-tight uppercase [font-stretch:80%] sm:block">
            Race-Weekend Advisor
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const { href, label, icon: Icon } = item
            const current = currentFor(pathname, item)
            return (
              <Link
                key={href}
                href={href}
                aria-current={current}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  current !== undefined
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
