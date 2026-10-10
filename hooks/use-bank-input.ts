"use client"

import { useState } from "react"

import { formatBankTenths, parseBank } from "@/lib/team/bank"

export type UseBankInputReturn = {
  value: string
  setValue: (v: string) => void
  /** parseBank(value).entered — false for blank/NaN/negative. */
  entered: boolean
  /** parseBank(value).tenths — integer tenths, 0 when not entered. */
  tenths: number
  /** Round the current value to one decimal (call from the input's onBlur). */
  normalize: () => void
}

/** Controlled bank-input state: the raw string plus its parsed entered/tenths. */
export function useBankInput(initialValue = ""): UseBankInputReturn {
  const [value, setValue] = useState(initialValue)
  const { entered, tenths } = parseBank(value)

  function normalize(): void {
    const trimmed = value.trim()
    const n = Number(trimmed)
    if (trimmed !== "" && Number.isFinite(n)) {
      setValue(formatBankTenths(Math.round(n * 10)))
    }
  }

  return { value, setValue, entered, tenths, normalize }
}
