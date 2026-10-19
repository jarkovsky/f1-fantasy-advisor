"use client"

import { Brain, ChartColumn, Moon, Sun } from "lucide-react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

// App chrome: the two labelled tabs float as a pill at the top of every page,
// and the mode toggle floats in the bottom-right corner, so nothing up top
// looks clickable that isn't a tab. Client components because the active tab
// needs usePathname and the toggle needs next-themes; both are cheap and
// render outside the streamed data holes.

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
export function ModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={className}
    >
      <Sun aria-hidden="true" className="size-5 dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-5 dark:block" />
    </Button>
  )
}

export function TopNav() {
  const pathname = usePathname()
  return (
    <header className="pointer-events-none sticky top-0 z-40 flex justify-center px-4 pt-3">
      <nav
        aria-label="Primary"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-background/85 p-1 shadow-lg ring-1 ring-grid-line backdrop-blur-md"
      >
        {NAV_ITEMS.map((item) => {
          const { href, label, icon: Icon } = item
          const current = currentFor(pathname, item)
          return (
            <Link
              key={href}
              href={href}
              aria-current={current}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
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
    </header>
  )
}

/** The mode toggle, floating in the bottom-right corner of every page. */
export function FloatingModeToggle() {
  return (
    <ModeToggle className="fixed right-4 bottom-4 z-40 size-11 rounded-full bg-background/85 shadow-lg ring-1 ring-grid-line backdrop-blur-md sm:right-6 sm:bottom-6" />
  )
}
