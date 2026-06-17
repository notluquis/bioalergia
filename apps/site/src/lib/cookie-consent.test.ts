import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCookieConsent, STORAGE_KEY } from "./cookie-consent";

describe("getCookieConsent", () => {
  const original = globalThis.window;

  afterEach(() => {
    // Restore whatever `window` was before each test mutated it.
    if (original === undefined) {
      // @ts-expect-error — deleting the test-injected global.
      delete globalThis.window;
    } else {
      globalThis.window = original;
    }
    vi.restoreAllMocks();
  });

  describe("without a window (SSR)", () => {
    beforeEach(() => {
      // @ts-expect-error — simulate the SSR branch.
      delete globalThis.window;
    });

    it("returns null", () => {
      expect(getCookieConsent()).toBeNull();
    });
  });

  describe("with a window", () => {
    let store: Record<string, string>;

    beforeEach(() => {
      store = {};
      globalThis.window = {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
        },
      } as unknown as Window & typeof globalThis;
    });

    it("returns 'accept' when stored", () => {
      store[STORAGE_KEY] = "accept";
      expect(getCookieConsent()).toBe("accept");
    });

    it("returns 'reject' when stored", () => {
      store[STORAGE_KEY] = "reject";
      expect(getCookieConsent()).toBe("reject");
    });

    it("returns null when nothing is stored", () => {
      expect(getCookieConsent()).toBeNull();
    });

    it("returns null for an unrecognized stored value", () => {
      store[STORAGE_KEY] = "maybe";
      expect(getCookieConsent()).toBeNull();
    });
  });
});
