// jsdom is missing several browser globals that UI components reach for
// (ResizeObserver, IntersectionObserver, matchMedia). These installers are
// exported as opt-in functions — NOT side-effecting imports and NOT wired into
// vitest.setup.ts — so each test that needs a stub asks for it explicitly.
// Globalizing them would silently paper over a component that forgot to guard a
// missing API. Every installer returns an uninstall fn restoring the prior
// value (a test installs in beforeEach, restores in afterEach).

/** Restores whatever was on the global before install (often undefined). */
type Uninstall = () => void

/** Minimal ResizeObserver: records callbacks, never fires (no layout in jsdom). */
export function installResizeObserverStub(): Uninstall {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const prior = globalThis.ResizeObserver
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof globalThis.ResizeObserver
  return () => {
    globalThis.ResizeObserver = prior
  }
}

/** Minimal IntersectionObserver: records callbacks, never fires. */
export function installIntersectionObserverStub(): Uninstall {
  class IntersectionObserverStub {
    readonly root = null
    readonly rootMargin = ""
    readonly thresholds: ReadonlyArray<number> = []
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  const prior = globalThis.IntersectionObserver
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof globalThis.IntersectionObserver
  return () => {
    globalThis.IntersectionObserver = prior
  }
}

/**
 * Minimal matchMedia returning a fixed `matches` for every query. The legacy
 * addListener/removeListener pair is included alongside the modern
 * addEventListener API since libraries reach for either.
 */
export function installMatchMediaStub(matches = false): Uninstall {
  function matchMediaStub(query: string): MediaQueryList {
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    } as MediaQueryList
  }
  const prior = window.matchMedia
  window.matchMedia = matchMediaStub as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = prior
  }
}
