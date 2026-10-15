import type { Snapshot } from "./types/feed"

import { describe, expect, it } from "vitest"

import { type Asset, parseDriversFeed } from "./schemas"
import { fetchOrSnapshot } from "./fetch-or-snapshot"
import race1 from "./__fixtures__/drivers.race1.json"

// The full degradation decision table, with an injected mock fetch.

const PATH = "/drivers/1_en.json"
const EMPTY: Asset[] = []

function mockFetch(handler: () => Promise<Response> | Response): typeof fetch {
  return (() => Promise.resolve(handler())) as unknown as typeof fetch
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "last-modified": "Fri, 05 Jun 2026 09:48:00 GMT" },
    ...init,
  })
}

const goodSnapshot = (): Snapshot => ({
  raw: race1,
  asOf: "Mon, 01 Jun 2026 19:12:00 GMT",
})

describe("fetchOrSnapshot decision table", () => {
  it("live 200 + valid → source 'live' with Last-Modified provenance", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, goodSnapshot, {
      fetchImpl: mockFetch(() => jsonResponse(race1)),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("live")
    expect(feed.meta.asOf).toBe("Fri, 05 Jun 2026 09:48:00 GMT")
    expect(feed.data).toHaveLength(4)
  })

  it("live 200 but schema-invalid → snapshot", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, goodSnapshot, {
      fetchImpl: mockFetch(() => jsonResponse({ Data: { Value: "nope" } })),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.meta.asOf).toBe("Mon, 01 Jun 2026 19:12:00 GMT")
    expect(feed.data).toHaveLength(4)
  })

  it("live 200 but body is not JSON → snapshot", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, goodSnapshot, {
      fetchImpl: mockFetch(() => new Response("<html>not json</html>")),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.data).toHaveLength(4)
  })

  it("HTTP 403 (race not yet published) → snapshot", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, goodSnapshot, {
      fetchImpl: mockFetch(() => new Response("AccessDenied", { status: 403 })),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
  })

  it("network failure (reject) → snapshot", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, goodSnapshot, {
      fetchImpl: (() => Promise.reject(new Error("ENOTFOUND"))) as unknown as typeof fetch,
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.data).toHaveLength(4)
  })

  it("live fails and no snapshot → typed empty value, never throws", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, () => null, {
      fetchImpl: mockFetch(() => new Response("", { status: 500 })),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.meta.asOf).toBe("")
    expect(feed.data).toEqual([])
  })

  it("live fails and snapshot is corrupt → typed empty value", async () => {
    const feed = await fetchOrSnapshot(
      PATH,
      parseDriversFeed,
      () => ({ raw: { junk: 1 }, asOf: "x" }),
      {
        fetchImpl: mockFetch(() => new Response("", { status: 500 })),
        empty: EMPTY,
      }
    )
    expect(feed.data).toEqual([])
  })
})
