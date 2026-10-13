"use client"

import type { Route } from "next"

import { useRouter, useSearchParams } from "next/navigation"
import { startTransition } from "react"

import { PRESET_IDS, type PresetId } from "@/lib/projections/types/presets"

/**
 * The active projection preset, read from and written to the `?preset=` URL
 * (shareable, deep-linkable). Call it under a Suspense boundary: during
 * prerendering, useSearchParams client-renders everything up to the nearest
 * one (the advisor island provides it). An unknown or absent param falls back
 * to "weighted-recent".
 */
export function usePresetParam(): { preset: PresetId; onPresetChange: (id: PresetId) => void } {
  const router = useRouter()
  const searchParams = useSearchParams()

  const presetParam = searchParams.get("preset")
  const preset: PresetId = (PRESET_IDS as readonly string[]).includes(presetParam ?? "")
    ? (presetParam as PresetId)
    : "weighted-recent"

  function onPresetChange(id: PresetId): void {
    startTransition(() => {
      router.replace(`/?preset=${id}` as Route, { scroll: false })
    })
  }

  return { preset, onPresetChange }
}
