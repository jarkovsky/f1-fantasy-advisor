import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { AppSidebar, MobileTopBar } from "@/app/_components/app-sidebar"
import { Footer } from "@/app/_components/footer"
import { ThemeProvider } from "@/app/_components/theme-provider"

import "./globals.css"

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  // Canonical base for OG/social URLs. Until the app has a deployed domain,
  // the env override keeps this honest (deploy sets NEXT_PUBLIC_SITE_URL).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Fantasy F1 Race-Weekend Advisor",
    template: "%s · Fantasy F1 Advisor",
  },
  description:
    "Optimal F1 Fantasy transfers and DRS Boost pick for the upcoming Grand Prix — free, no login, with the math shown.",
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
      className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <body className="flex min-h-dvh tabular-nums">
        <ThemeProvider>
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
