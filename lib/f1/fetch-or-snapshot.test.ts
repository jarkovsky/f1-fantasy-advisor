import { describe, expect, it } from "vitest"

import race1 from "./__fixtures__/drivers.race1.json"
import { fetchOrSnapshot, probeFeedPublished } from "./fetch-or-snapshot"
import { type Asset, parseDriversFeed } from "./schemas"
import type { Snapshot } from "./snapshot-data"

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
      fetchImpl: (() =>
        Promise.reject(new Error("ENOTFOUND"))) as unknown as typeof fetch,
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.data).toHaveLength(4)
  })

  it("live fails AND no snapshot → typed empty value, never throws", async () => {
    const feed = await fetchOrSnapshot(PATH, parseDriversFeed, () => null, {
      fetchImpl: mockFetch(() => new Response("", { status: 500 })),
      empty: EMPTY,
    })
    expect(feed.meta.source).toBe("snapshot")
    expect(feed.meta.asOf).toBe("")
    expect(feed.data).toEqual([])
  })

  it("live fails AND snapshot is corrupt → typed empty value", async () => {
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

// Publication probe: status-only, NEVER throws. ok ⇒ true, everything else ⇒ false.

describe("probeFeedPublished decision table", () => {
  it("HTTP 200 → true", async () => {
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: mockFetch(() => new Response("body", { status: 200 })),
      })
    ).resolves.toBe(true)
  })

  it("HTTP 403 (race not yet published) → false", async () => {
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: mockFetch(
          () => new Response("AccessDenied", { status: 403 })
        ),
      })
    ).resolves.toBe(false)
  })

  it("HTTP 404 → false", async () => {
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: mockFetch(() => new Response("", { status: 404 })),
      })
    ).resolves.toBe(false)
  })

  it("HTTP 500 → false", async () => {
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: mockFetch(() => new Response("", { status: 500 })),
      })
    ).resolves.toBe(false)
  })

  it("network failure (reject) → false, never throws", async () => {
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: (() =>
          Promise.reject(new Error("ENOTFOUND"))) as unknown as typeof fetch,
      })
    ).resolves.toBe(false)
  })

  it("timeout/abort (rejects with abort) → false, never throws", async () => {
    // Mirrors the abort path: AbortSignal.timeout fires → fetch rejects.
    await expect(
      probeFeedPublished(PATH, {
        fetchImpl: (() =>
          Promise.reject(
            new DOMException("The operation was aborted.", "TimeoutError")
          )) as unknown as typeof fetch,
      })
    ).resolves.toBe(false)
  })
})
