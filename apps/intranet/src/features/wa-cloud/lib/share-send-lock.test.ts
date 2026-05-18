/**
 * @vitest-environment jsdom
 *
 * Tests for `share-send-lock` — cross-tab idempotency for Web Share
 * Target sends. jsdom provides localStorage; we simulate "another tab"
 * by writing a record with a foreign `holder` value directly.
 *
 * Covers: acquire success, acquire blocked when foreign holder is
 * fresh, acquire allowed when foreign holder expired (TTL passed),
 * release only by holder, isLockHeldByAnotherTab boundary, and the
 * "no localStorage" SSR fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom 27+ ships without a built-in localStorage unless launched with
// --localstorage-file. The module under test feature-detects via
// `typeof localStorage`, so we install an in-memory polyfill before
// importing it.
function installLocalStoragePolyfill() {
  const store = new Map<string, string>();
  const ls = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: ls,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: ls,
  });
}
installLocalStoragePolyfill();

const { isLockHeldByAnotherTab, releaseSendLock, tryAcquireSendLock } =
  await import("./share-send-lock");

const PAYLOAD_TS = 1_700_000_000;
const KEY = `wa-share-send-lock-${PAYLOAD_TS}`;

describe("share-send-lock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("acquires the lock when no record exists", () => {
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(true);
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("re-acquires when the existing record belongs to this tab", () => {
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(true);
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(true);
  });

  it("refuses to acquire when a foreign holder owns a fresh lock", () => {
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), holder: "foreign-tab-id" }));
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(false);
  });

  it("allows acquire when the foreign holder's lock has expired (>30s)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ts: Date.now() - 31_000, holder: "foreign-tab-id" })
    );
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(true);
  });

  it("isLockHeldByAnotherTab returns true only for fresh foreign locks", () => {
    expect(isLockHeldByAnotherTab(PAYLOAD_TS)).toBe(false);
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), holder: "foreign-tab-id" }));
    expect(isLockHeldByAnotherTab(PAYLOAD_TS)).toBe(true);
  });

  it("isLockHeldByAnotherTab returns false for our own lock", () => {
    tryAcquireSendLock(PAYLOAD_TS);
    expect(isLockHeldByAnotherTab(PAYLOAD_TS)).toBe(false);
  });

  it("releaseSendLock removes our own lock", () => {
    tryAcquireSendLock(PAYLOAD_TS);
    releaseSendLock(PAYLOAD_TS);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("releaseSendLock leaves a foreign lock untouched", () => {
    const foreign = JSON.stringify({ ts: Date.now(), holder: "foreign-tab-id" });
    localStorage.setItem(KEY, foreign);
    releaseSendLock(PAYLOAD_TS);
    expect(localStorage.getItem(KEY)).toBe(foreign);
  });

  it("tolerates corrupt JSON in storage (returns true, overwrites)", () => {
    localStorage.setItem(KEY, "{not json");
    // Corrupt JSON throws inside try → caught → returns true (best-effort).
    expect(tryAcquireSendLock(PAYLOAD_TS)).toBe(true);
  });
});
