/**
 * Tests for `useWakeLock` — Screen Wake Lock API wrapper.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWakeLock } from "./use-wake-lock";

interface FakeWakeLockSentinel {
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

interface NavWakeLock {
  wakeLock?: { request: (type: "screen") => Promise<FakeWakeLockSentinel> };
}

describe("useWakeLock", () => {
  let requestMock: ReturnType<typeof vi.fn>;
  let sentinel: FakeWakeLockSentinel;

  beforeEach(() => {
    sentinel = {
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };
    requestMock = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      writable: true,
      value: { request: requestMock },
    });
  });

  afterEach(() => {
    delete (navigator as unknown as NavWakeLock).wakeLock;
  });

  it("requests the wake lock on mount and reports isLocked = true", async () => {
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => {
      expect(result.current.isLocked).toBe(true);
    });
    expect(requestMock).toHaveBeenCalledWith("screen");
  });

  it("releases the wake lock on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock());
    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    unmount();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it("returns isLocked = false on platforms without wakeLock", () => {
    delete (navigator as unknown as NavWakeLock).wakeLock;
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.isLocked).toBe(false);
  });

  it("silently swallows NotAllowedError (user denied or tab hidden)", async () => {
    const err = new Error("denied");
    err.name = "NotAllowedError";
    requestMock.mockRejectedValueOnce(err);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderHook(() => useWakeLock());
    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    // NotAllowedError is intentionally NOT logged
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("logs other errors via console.error", async () => {
    const err = new Error("boom");
    err.name = "AbortError";
    requestMock.mockRejectedValueOnce(err);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderHook(() => useWakeLock());
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    errSpy.mockRestore();
  });
});
