"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Canonical next-themes wrapper (shadcn pattern). Light is the product default
 * (spec §10 M5): no system preference — the user opts into dark via the
 * sidebar toggle, persisted under next-themes' `theme` localStorage key.
 * next-themes injects a blocking pre-paint script, so the PPR static shell
 * stays theme-free and there is no flash on either theme.
 */
export function ThemeProvider({
  children,
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
