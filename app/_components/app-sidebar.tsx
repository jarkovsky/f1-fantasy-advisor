"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChartColumn, Flag, Gauge, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * App chrome (spec §10 M5): a floating icon rail on md+ — a rounded card
 * sticky beside the content, reference-styled — and a slim top bar below md.
 * Pure client chrome: active state needs usePathname, the mode toggle needs
 * next-themes; both are cheap and outside the PPR data hole.
 */
const NAV_ITEMS = [
  { href: "/", label: "Advisor", icon: Gauge },
  { href: "/stats", label: "Stats", icon: ChartColumn },
] as const

function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Fantasy F1 Race-Weekend Advisor — home"
      className={cn(
        "flex items-center justify-center rounded-md bg-accent-f1-fill text-accent-f1-foreground transition-colors hover:bg-accent-f1-fill-hover",
        className
      )}
    >
      <Flag aria-hidden="true" className="size-5" />
    </Link>
  )
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

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <aside className="sticky top-0 z-40 hidden h-dvh shrink-0 py-4 pl-4 md:block">
      <div className="flex h-full w-16 flex-col items-center gap-3 rounded-xl border border-grid-line bg-card py-4 shadow-md">
        <Brand className="size-10" />
        <TooltipProvider>
          <nav
            aria-label="Primary"
            className="flex flex-col items-center gap-2"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      <span className="sr-only">{label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
        </TooltipProvider>
        <div className="mt-auto">
          <ModeToggle />
        </div>
      </div>
    </aside>
  )
}

export function MobileTopBar() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-grid-line bg-background/90 px-4 py-2 backdrop-blur md:hidden">
      <Brand className="size-8 [&_svg]:size-4" />
      <nav aria-label="Primary" className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="ml-auto">
        <ModeToggle />
      </div>
    </header>
  )
}
