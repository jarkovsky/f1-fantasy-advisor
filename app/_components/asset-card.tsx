"use client"

import { CheckIcon } from "lucide-react"
import type * as React from "react"

import { type AssetLite, assetColorKey } from "@/lib/asset-lite"
import { formatPriceTenths } from "@/lib/format"
import { teamColor } from "@/lib/team-colors"
import { cn } from "@/lib/utils"

/**
 * One selectable picker card — dumb/presentational. Owns no selection state:
 * the parent listbox drives `selected`/`disabled` and the roving-tabindex
 * plumbing (id/tabIndex/onToggle/onFocus, spread through ...buttonProps). It is
 * a real <button role="option"> so the listbox grid stays a proper a11y widget.
 *
 * Color is decorative only (spec §10): a 3px team-color left border and the
 * monogram ring. Never the sole information carrier — the TLA and check glyph
 * carry the actual signal.
 */

type AssetCardProps = {
  asset: AssetLite
  selected: boolean
  /** Kind quota full and this card is not already selected. */
  disabled: boolean
} & Omit<React.ComponentProps<"button">, "disabled">

export function AssetCard({
  asset,
  selected,
  disabled,
  className,
  ...buttonProps
}: AssetCardProps) {
  const color = teamColor(assetColorKey(asset))
  const ppm =
    asset.priceTenths === 0
      ? "—"
      : (asset.seasonPoints / (asset.priceTenths / 10)).toFixed(1)
  const monogram = monogramText(asset)

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-selected={selected || undefined}
      style={{ borderLeftColor: color }}
      className={cn(
        "group/card relative flex min-h-11 w-full items-center gap-3 rounded-lg border border-l-[3px] border-grid-line bg-surface-1 px-3 py-2 text-left transition-colors outline-none",
        "hover:bg-surface-2",
        "focus-visible:ring-2 focus-visible:ring-accent-f1",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected && "bg-surface-2 ring-2 ring-accent-f1",
        className
      )}
      {...buttonProps}
    >
      {asset.headshotPath ? (
        // Bundled local headshot (public/headshots/*): no remote loader to
        // optimize through and the file is already grid-sized, so next/image
        // adds nothing. The spec mandates a plain decorative <img alt="">.
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          alt=""
          src={asset.headshotPath}
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full bg-surface-2 object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ "--tw-ring-color": color } as React.CSSProperties}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-semibold ring-1 ring-[var(--tw-ring-color)]"
        >
          {monogram}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5 truncate">
          <span className="font-mono font-semibold">
            {asset.kind === "driver" ? asset.tla : asset.displayName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {asset.fullName}
          </span>
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatPriceTenths(asset.priceTenths)} · {asset.seasonPoints} pts ·{" "}
          {ppm} PPM · {asset.selectedPercent}% sel
        </span>
      </span>

      {selected && (
        <CheckIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-accent-f1"
        />
      )}
    </button>
  )
}

/** Two-initial monogram for the avatar fallback: TLA first, else fullName words. */
function monogramText(asset: AssetLite): string {
  if (asset.tla) return asset.tla.slice(0, 3)
  const words = asset.fullName.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ""
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "—"
}
