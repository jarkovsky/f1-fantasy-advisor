// jsdom is missing browser globals that UI components reach for
// (ResizeObserver, matchMedia). These installers are exported as opt-in
// functions — not side-effecting imports and not wired into vitest.setup.ts —
// so each test that needs a stub asks for it explicitly. Globalizing them would
// silently paper over a component that forgot to guard a missing API. Every
// installer returns an uninstall fn restoring the prior value (a test installs
// in beforeEach, restores in afterEach).

/** Restores whatever was on the global before install (often undefined). */
type Uninstall = () => void

/** Minimal no-op ResizeObserver: never fires (jsdom has no layout). */
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
