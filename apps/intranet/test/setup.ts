import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy*/waitFor default to a 1000ms poll window — too tight when a
// HeroUI + React-Aria render is starved for CPU under full-suite
// parallelism (a normally-50ms render can take >1s). Widen the async
// util timeout so slow renders resolve instead of flaking; a genuinely
// missing element still fails (just after 5s), so real bugs aren't hidden.
configure({ asyncUtilTimeout: 5_000 });

// jsdom doesn't ship ResizeObserver / IntersectionObserver / matchMedia
// — HeroUI v3 components (ScrollShadow, Tabs, Popover) call them on
// mount, so install no-op polyfills once at suite startup.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {
      // noop
    }
    unobserve(): void {
      // noop
    }
    disconnect(): void {
      // noop
    }
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: readonly number[] = [];
    observe(): void {
      // noop
    }
    unobserve(): void {
      // noop
    }
    disconnect(): void {
      // noop
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
