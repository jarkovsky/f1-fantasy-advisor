"use client"

import { Info } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * An "i" button that explains the thing beside it, so labels stay short and
 * the explanation is one hover (or focus, or tap) away.
 *
 * Radix tooltips open on hover and focus but ignore taps, so the trigger also
 * opens on click; preventing the pointerdown default stops Radix from closing
 * it again on the same press. A tap outside or Escape closes it. Carries its
 * own provider, so it works anywhere without app-level setup.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** What the tip explains; the button is named "About {label}". */
  label: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${label}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent-f1",
              className
            )}
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          sideOffset={4}
          className="max-w-64 text-xs leading-relaxed font-normal tracking-normal text-pretty normal-case"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
