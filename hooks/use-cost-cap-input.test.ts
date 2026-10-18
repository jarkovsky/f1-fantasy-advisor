import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useCostCapInput } from "./use-cost-cap-input"

describe("useCostCapInput", () => {
  it("starts from the initial value and derives entered/tenths", () => {
    const { result } = renderHook(() => useCostCapInput("2.5"))
    expect(result.current.value).toBe("2.5")
    expect(result.current.entered).toBe(true)
    expect(result.current.tenths).toBe(25)
  })

  it("defaults to an empty, not-entered field", () => {
    const { result } = renderHook(() => useCostCapInput())
    expect(result.current.value).toBe("")
    expect(result.current.entered).toBe(false)
    expect(result.current.tenths).toBe(0)
  })

  it("tracks setValue and re-derives entered/tenths", () => {
    const { result } = renderHook(() => useCostCapInput())
    act(() => result.current.setValue("3.2"))
    expect(result.current.entered).toBe(true)
    expect(result.current.tenths).toBe(32)
  })

  it("normalize() rounds to one decimal; empty stays empty", () => {
    const { result } = renderHook(() => useCostCapInput("2.55"))
    act(() => result.current.normalize())
    expect(result.current.value).toBe("2.6")

    const empty = renderHook(() => useCostCapInput(""))
    act(() => empty.result.current.normalize())
    expect(empty.result.current.value).toBe("")
  })
})
