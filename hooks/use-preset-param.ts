"use client"

import type { Route } from "next"

import { useRouter, useSearchParams } from "next/navigation"
import { startTransition } from "react"

import { PRESET_IDS, type PresetId } from "@/lib/projections/types/presets"

/**
 * The active projection preset, read from and written to the `?preset=` URL
 * (shareable, deep-linkable). MUST be called from inside a Suspense boundary —
 * useSearchParams bails the whole route to CSR otherwise (the advisor island is
 * already wrapped). An unknown/absent param falls back to "weighted-recent".
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
