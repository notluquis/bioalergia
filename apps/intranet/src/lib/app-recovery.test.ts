/**
 * Tests for `app-recovery` — global fallback signalling + cache reset helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAppCaches, clearOnlyCaches, onAppFallback, signalAppFallback } from "./app-recovery";

describe("signalAppFallback / onAppFallback", () => {
  afterEach(() => {
    delete (window as Window & { __APP_FALLBACK_REASON__?: unknown }).__APP_FALLBACK_REASON__;
  });

  it("fires the listener with the dispatched reason", () => {
    const handler = vi.fn();
    const off = onAppFallback(handler);

    signalAppFallback("chunk");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("chunk");

    off();
  });

  it("writes the reason onto window.__APP_FALLBACK_REASON__", () => {
    signalAppFallback("offline");
    expect(window.__APP_FALLBACK_REASON__).toBe("offline");
  });

  it("returns an off() that stops further notifications", () => {
    const handler = vi.fn();
    const off = onAppFallback(handler);
    off();
    signalAppFallback("update");
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores events whose detail lacks a reason field", () => {
    const handler = vi.fn();
    const off = onAppFallback(handler);
    window.dispatchEvent(new CustomEvent("app:fallback", { detail: {} }));
    expect(handler).not.toHaveBeenCalled();
    off();
  });
});

describe("clearOnlyCaches / clearAppCaches", () => {
  let cachesKeys: ReturnType<typeof vi.fn>;
  let cachesDelete: ReturnType<typeof vi.fn>;
  let originalCaches: CacheStorage | undefined;
  let originalSW: ServiceWorkerContainer | undefined;
  let unregister: ReturnType<typeof vi.fn>;
  let getRegistrations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cachesKeys = vi.fn().mockResolvedValue(["v1", "v2"]);
    cachesDelete = vi.fn().mockResolvedValue(true);
    originalCaches = (globalThis as { caches?: CacheStorage }).caches;
    (globalThis as { caches?: unknown }).caches = {
      keys: cachesKeys,
      delete: cachesDelete,
    };

    unregister = vi.fn().mockResolvedValue(true);
    getRegistrations = vi.fn().mockResolvedValue([{ unregister }, { unregister }]);
    originalSW = (navigator as Navigator & { serviceWorker?: ServiceWorkerContainer })
      .serviceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations },
    });
  });

  afterEach(() => {
    if (originalCaches === undefined) {
      delete (globalThis as { caches?: unknown }).caches;
    } else {
      (globalThis as { caches?: unknown }).caches = originalCaches;
    }
    if (originalSW === undefined) {
      // jsdom can't truly remove; leave as no-op
    } else {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalSW,
      });
    }
  });

  it("clearOnlyCaches removes every cache entry but does not touch SW", async () => {
    await clearOnlyCaches();
    expect(cachesKeys).toHaveBeenCalledTimes(1);
    expect(cachesDelete).toHaveBeenCalledTimes(2);
    expect(getRegistrations).not.toHaveBeenCalled();
  });

  it("clearAppCaches unregisters SW registrations AND clears caches", async () => {
    await clearAppCaches();
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(cachesKeys).toHaveBeenCalledTimes(1);
    expect(cachesDelete).toHaveBeenCalledTimes(2);
  });
});
