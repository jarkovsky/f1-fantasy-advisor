import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectionControls } from "@/app/_components/projection-controls"
import type { WhatIfMode } from "@/app/_components/advisor-types"
import { assembleHistory } from "@/lib/f1/history"
import {
  PRESET_REGISTRY,
  type PresetId,
  type ProjectionResult,
  projectAssets,
} from "@/lib/projections"
import { teamStore } from "@/lib/store"
import { fixtureAssets, fixtureHistory } from "@/test/fixtures"
import {
  installMatchMediaStub,
  installResizeObserverStub,
} from "@/test/stubs/dom"

// ---------------------------------------------------------------------------
// Real projection results drive the gating + confidence copy — no hand-rolled
// literals. WARM: fixtureHistory(6) → 5 completed races, 3 sprints, coldStart
// false (history presets enabled). COLD: a pending-only race assembly →
// coldStart true (history presets gated, equal-ppm stays enabled).
// ---------------------------------------------------------------------------
const WARM: ProjectionResult = projectAssets(
  fixtureHistory(6),
  { isSprint: false },
  { preset: "season-average" }
)
const COLD: ProjectionResult = projectAssets(
  assembleHistory([{ raceNumber: 6, assets: fixtureAssets(6) }]),
  { isSprint: false },
  { preset: "equal-ppm" }
)

// Radix Slider/Select reach for ResizeObserver + matchMedia; jsdom lacks both.
let uninstallResizeObserver: () => void
let uninstallMatchMedia: () => void

// Radix Select also calls these on its trigger/items; jsdom does not implement
// them. Stub once so the open/pick path does not throw.
const origPointerCapture = Element.prototype.hasPointerCapture
const origScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  localStorage.clear()
  teamStore.__resetForTests()
  uninstallResizeObserver = installResizeObserverStub()
  uninstallMatchMedia = installMatchMediaStub()
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
  uninstallResizeObserver()
  uninstallMatchMedia()
  Element.prototype.hasPointerCapture = origPointerCapture
  Element.prototype.scrollIntoView = origScrollIntoView
  localStorage.clear()
  teamStore.__resetForTests()
})

type ControlProps = Parameters<typeof ProjectionControls>[0]

function renderControls(props?: Partial<ControlProps>) {
  const onPresetChange = vi.fn<(id: PresetId) => void>()
  const onBlendWeightChange = vi.fn<(w: number) => void>()
  const onWhatIfChange = vi.fn<(mode: WhatIfMode) => void>()
  const utils = render(
    <ProjectionControls
      preset="season-average"
      onPresetChange={onPresetChange}
      blendWeight={0.5}
      onBlendWeightChange={onBlendWeightChange}
      whatIf="none"
      onWhatIfChange={onWhatIfChange}
      projection={WARM}
      {...props}
    />
  )
  return { ...utils, onPresetChange, onBlendWeightChange, onWhatIfChange }
}

describe("ProjectionControls", () => {
  // Opening a portalled Radix Select under full-suite CPU load can exceed the
  // default 5s test timeout (it resolves in ms when unloaded) — give headroom.
  it(
    "renders every PRESET_REGISTRY label as an option",
    { timeout: 20_000 },
    async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      renderControls()
      await user.click(
        screen.getByRole("combobox", { name: /projection model/i })
      )

      const listbox = screen.getByRole("listbox")
      for (const def of PRESET_REGISTRY) {
        expect(
          within(listbox).getByRole("option", {
            name: new RegExp(def.label.replace(/[()]/g, "\\$&")),
          })
        ).toBeInTheDocument()
      }
      // Exactly the registry's count — no extra/missing options.
      expect(within(listbox).getAllByRole("option")).toHaveLength(
        PRESET_REGISTRY.length
      )
    }
  )

  it("gates history presets with the needs-≥ hint at cold start; equal-ppm stays enabled", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderControls({ preset: "equal-ppm", projection: COLD })
    await user.click(
      screen.getByRole("combobox", { name: /projection model/i })
    )

    const listbox = screen.getByRole("listbox")
    for (const def of PRESET_REGISTRY) {
      const option = within(listbox).getByRole("option", {
        name: new RegExp(def.label.replace(/[()]/g, "\\$&")),
      })
      if (def.historyBased) {
        expect(option).toHaveAttribute("aria-disabled", "true")
        expect(option).toHaveTextContent(
          `needs ≥${def.minRaces} completed race`
        )
      } else {
        expect(option).not.toHaveAttribute("aria-disabled", "true")
      }
    }
  })

  it("shows the blend slider only when the preset is custom-blend", () => {
    const { rerender } = renderControls({ preset: "season-average" })
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()

    rerender(
      <ProjectionControls
        preset="custom-blend"
        onPresetChange={vi.fn()}
        blendWeight={0.5}
        onBlendWeightChange={vi.fn()}
        whatIf="none"
        onWhatIfChange={vi.fn()}
        projection={WARM}
      />
    )
    expect(screen.getByRole("slider")).toBeInTheDocument()
  })

  it("arrow keys on the slider thumb fire onBlendWeightChange with a changed value", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const { onBlendWeightChange } = renderControls({
      preset: "custom-blend",
      blendWeight: 0.5,
    })
    const slider = screen.getByRole("slider")
    slider.focus()
    await user.keyboard("{ArrowRight}")
    expect(onBlendWeightChange).toHaveBeenCalled()
    // step = 0.05 → 0.5 + 0.05 = 0.55.
    expect(onBlendWeightChange.mock.calls.at(-1)?.[0]).toBeCloseTo(0.55, 10)

    onBlendWeightChange.mockClear()
    await user.keyboard("{ArrowLeft}")
    expect(onBlendWeightChange.mock.calls.at(-1)?.[0]).toBeLessThan(0.55)
  })

  it("selecting a preset fires onPresetChange with the chosen id", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const { onPresetChange } = renderControls({ preset: "season-average" })
    await user.click(
      screen.getByRole("combobox", { name: /projection model/i })
    )

    const listbox = screen.getByRole("listbox")
    await user.click(
      within(listbox).getByRole("option", { name: /Equal PPM/i })
    )
    expect(onPresetChange).toHaveBeenCalledWith("equal-ppm")
  })

  it("Wildcard and Limitless are mutually exclusive via onWhatIfChange", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    // Wildcard already on → toggling Limitless on must report wildcard off,
    // i.e. the new mode "limitless" (the switches are exclusive, not additive).
    const { onWhatIfChange } = renderControls({ whatIf: "wildcard" })

    await user.click(screen.getByRole("switch", { name: /limitless/i }))
    expect(onWhatIfChange).toHaveBeenCalledWith("limitless")

    onWhatIfChange.mockClear()
    // Turning the active wildcard off reports "none".
    await user.click(screen.getByRole("switch", { name: /wildcard/i }))
    expect(onWhatIfChange).toHaveBeenCalledWith("none")
  })

  it("confidence line renders the completed-race / sprint count from props", () => {
    renderControls()
    // WARM basis: 5 completed races, 3 sprints.
    expect(
      screen.getByText(/Based on 5 completed races, 3 sprints\./)
    ).toBeInTheDocument()
    // No cold-start warning when there is history.
    expect(screen.queryByText(/no history yet/i)).not.toBeInTheDocument()
  })
})
