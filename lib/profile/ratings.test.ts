import { describe, expect, it } from "vitest"

import { rankIntoBands } from "./ratings"

describe("rankIntoBands", () => {
  it("ranks higher values first and shares rank and band on ties", () => {
    const out = rankIntoBands({ a: 10, b: 8, c: 8, d: 5, e: 1 })
    expect(out.a).toEqual({ rank: 1, of: 5, rating: 5 })
    expect(out.b).toEqual({ rank: 2, of: 5, rating: 4 })
    expect(out.c).toEqual({ rank: 2, of: 5, rating: 4 })
    expect(out.d).toEqual({ rank: 4, of: 5, rating: 2 })
    expect(out.e).toEqual({ rank: 5, of: 5, rating: 1 })
  })

  it("leaves null values unranked and out of the field size", () => {
    const out = rankIntoBands({ a: 3, b: null, c: 1 })
    expect(out.b).toBeUndefined()
    expect(out.a?.of).toBe(2)
    expect(out.c).toEqual({ rank: 2, of: 2, rating: 3 })
  })

  it("splits a 22-driver grid into five non-empty bands from 5 down to 1", () => {
    const values = Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`d${i}`, 22 - i]))
    const out = rankIntoBands(values)
    const counts = [1, 2, 3, 4, 5].map(
      (band) => Object.values(out).filter((r) => r.rating === band).length
    )
    expect(counts).toEqual([4, 4, 5, 4, 5])
    expect(out.d0?.rating).toBe(5)
    expect(out.d21).toEqual({ rank: 22, of: 22, rating: 1 })
  })

  it("returns nothing for an empty or all-null field", () => {
    expect(rankIntoBands({})).toEqual({})
    expect(rankIntoBands({ a: null })).toEqual({})
  })
})
