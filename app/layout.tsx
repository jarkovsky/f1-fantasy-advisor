import type { Metadata } from "next"

import { Archivo, Geist_Mono, Inter } from "next/font/google"

import { FloatingModeToggle, TopNav } from "@/app/_components/chrome/top-nav"
import { ThemeProvider } from "@/app/_components/chrome/theme-provider"
import { Footer } from "@/app/_components/chrome/footer"

import "./globals.css"

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// Display face for the driver hero and race widgets: one variable file covers
// the expanded surnames (wdth 125) and the condensed widget titles (wdth 62).
const fontDisplay = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["wdth"],
})

export const metadata: Metadata = {
  // Canonical base for OG/social URLs. Until the app has a deployed domain,
  // the env override keeps this honest (deploy sets NEXT_PUBLIC_SITE_URL).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "F1 Fantasy Advisor",
    template: "%s · F1 Fantasy Advisor",
  },
  description: "Optimal F1 Fantasy transfers and the x2 Boost pick for the upcoming Grand Prix.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: next-themes mutates the html class pre-paint,
    // so the server markup (class-free) intentionally differs on this element.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable} font-sans antialiased`}
    >
      <body className="flex min-h-dvh flex-col tabular-nums">
        <ThemeProvider>
          <TopNav />
          <div className="flex-1">{children}</div>
          <Footer />
          <FloatingModeToggle />
        </ThemeProvider>
      </body>
    </html>
  )
}
