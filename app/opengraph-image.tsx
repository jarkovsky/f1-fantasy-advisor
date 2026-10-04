import { ImageResponse } from "next/og"

import { TEAM_COLORS } from "@/lib/team-colors"

// Dynamic OG card (spec §9.3 "Dynamic OG image"), telemetry-styled.
//
// NETWORK-FREE BY CONTRACT: this route renders at build under PPR and must stay
// offline-deterministic. No font fetching (we lean on satori's bundled default
// font), no Google Fonts, no fs reads, no feed/network access. Palette values
// below are inlined as hex/oklch to mirror app/globals.css since satori cannot
// resolve CSS custom properties.

export const alt = "Fantasy F1 Race-Weekend Advisor"

export const size = { width: 1200, height: 630 }

export const contentType = "image/png"

// Note: metadata-image routes register as dynamic (ƒ) by framework convention;
// the render itself is deterministic and network-free, so on-demand serving
// never violates the offline guarantee.

// Mirrors of the .dark carbon/accent palette from app/globals.css. Inlined as
// concrete colors because satori has no access to CSS variables or @theme.
const CARBON = "#0a0a0c" // --surface-0 / --background (near-black carbon)
const SURFACE_1 = "#16161a" // --surface-1 panel
const F1_RED = "#e8112d" // --accent-f1 family (F1 red top bar + accents)
const WHITE = "#fafafa" // --foreground
const MUTED = "#a1a1aa" // --muted-foreground
const GRID_LINE = "rgba(255,255,255,0.06)" // --grid-line hairline

// 11 constructor chips for the timing-screen strip (Object.values of the pure,
// importable TEAM_COLORS map).
const CHIPS = Object.values(TEAM_COLORS)

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: CARBON,
        // Subtle timing-screen grid hairlines.
        backgroundImage: `linear-gradient(${GRID_LINE} 1px, transparent 1px), linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {/* 6px F1-red top bar. */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 6,
          backgroundColor: F1_RED,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "72px 80px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Eyebrow chip. */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 12,
              padding: "8px 16px",
              marginBottom: 36,
              borderRadius: 6,
              backgroundColor: SURFACE_1,
              border: `1px solid ${GRID_LINE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: F1_RED,
              }}
            />
            <div
              style={{
                fontSize: 22,
                letterSpacing: 4,
                fontWeight: 600,
                color: MUTED,
              }}
            >
              RACE WEEK ADVISOR
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: WHITE,
            }}
          >
            Fantasy F1 Race-Weekend Advisor
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: MUTED,
              maxWidth: 940,
            }}
          >
            Optimal transfers and DRS Boost for the upcoming Grand Prix — free, with the math shown.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Decorative timing-screen strip: 11 constructor color chips. */}
          <div style={{ display: "flex", gap: 12 }}>
            {CHIPS.map((color, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  width: 88,
                  height: 16,
                  borderRadius: 4,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>

          {/* Mono-feel footer line. */}
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontFamily: "monospace",
              letterSpacing: 0.5,
              color: MUTED,
            }}
          >
            1,448,370 squads searched · exact optimum · ~6 ms
          </div>
        </div>
      </div>
    </div>,
    { ...size }
  )
}
