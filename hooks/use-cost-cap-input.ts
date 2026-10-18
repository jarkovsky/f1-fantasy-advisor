"use client"

import { useState } from "react"

import { formatCostCapTenths, parseCostCap } from "@/lib/team/cost-cap"

export type UseCostCapInputReturn = {
  value: string
  setValue: (v: string) => void
  /** parseCostCap(value).entered — false for blank/NaN/negative. */
  entered: boolean
  /** parseCostCap(value).tenths — integer tenths, 0 when not entered. */
  tenths: number
  /** Round the current value to one decimal (call from the input's onBlur). */
  normalize: () => void
}

/** Controlled cost-cap-input state: the raw string plus its parsed entered/tenths. */
export function useCostCapInput(initialValue = ""): UseCostCapInputReturn {
  const [value, setValue] = useState(initialValue)
  const { entered, tenths } = parseCostCap(value)

  function normalize(): void {
    const trimmed = value.trim()
    const n = Number(trimmed)
    if (trimmed !== "" && Number.isFinite(n)) {
      setValue(formatCostCapTenths(Math.round(n * 10)))
    }
  }

  return { value, setValue, entered, tenths, normalize }
}
