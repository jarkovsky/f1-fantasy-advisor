import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

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
    // Dark-only telemetry design: the dark class is applied statically (no theme island).
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <body className="tabular-nums">{children}</body>
    </html>
  )
}
