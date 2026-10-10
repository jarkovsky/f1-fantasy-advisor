import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useBankInput } from "./use-bank-input"

describe("useBankInput", () => {
  it("starts from the initial value and derives entered/tenths", () => {
    const { result } = renderHook(() => useBankInput("2.5"))
    expect(result.current.value).toBe("2.5")
    expect(result.current.entered).toBe(true)
    expect(result.current.tenths).toBe(25)
  })

  it("defaults to an empty, not-entered field", () => {
    const { result } = renderHook(() => useBankInput())
    expect(result.current.value).toBe("")
    expect(result.current.entered).toBe(false)
    expect(result.current.tenths).toBe(0)
  })

  it("tracks setValue and re-derives entered/tenths", () => {
    const { result } = renderHook(() => useBankInput())
    act(() => result.current.setValue("3.2"))
    expect(result.current.entered).toBe(true)
    expect(result.current.tenths).toBe(32)
  })

  it("normalize() rounds to one decimal; empty stays empty", () => {
    const { result } = renderHook(() => useBankInput("2.55"))
    act(() => result.current.normalize())
    expect(result.current.value).toBe("2.6")

    const empty = renderHook(() => useBankInput(""))
    act(() => empty.result.current.normalize())
    expect(empty.result.current.value).toBe("")
  })
})
