import type { WhatIfMode } from "@/lib/advisor/types/contract"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { ChipPreview } from "./chip-preview"

afterEach(cleanup)

describe("ChipPreview", () => {
  it("Wildcard and Limitless are mutually exclusive via onWhatIfChange", async () => {
    const user = userEvent.setup()
    const onWhatIfChange = vi.fn<(mode: WhatIfMode) => void>()
    // Wildcard already on → toggling Limitless on must report wildcard off,
    // i.e. the new mode "limitless" (the switches are exclusive, not additive).
    render(<ChipPreview whatIf="wildcard" onWhatIfChange={onWhatIfChange} />)

    expect(screen.getByRole("switch", { name: /wildcard/i })).toBeChecked()
    expect(screen.getByRole("switch", { name: /limitless/i })).not.toBeChecked()

    await user.click(screen.getByRole("switch", { name: /limitless/i }))
    expect(onWhatIfChange).toHaveBeenCalledWith("limitless")

    onWhatIfChange.mockClear()
    // Turning the active wildcard off reports "none".
    await user.click(screen.getByRole("switch", { name: /wildcard/i }))
    expect(onWhatIfChange).toHaveBeenCalledWith("none")
  })

  it("names the section as chips, with each chip's effect spelled out", () => {
    render(<ChipPreview whatIf="none" onWhatIfChange={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Chips" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "About chips" })).toBeInTheDocument()
    expect(screen.getByText(/no Cost Cap for one race week/)).toBeInTheDocument()
  })
})
