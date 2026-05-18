/**
 * Tests for `useAppBadge` — Badging API wrapper.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppBadge } from "./use-app-badge";

type NavWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

describe("useAppBadge", () => {
  let setAppBadgeMock: ReturnType<typeof vi.fn>;
  let clearAppBadgeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAppBadgeMock = vi.fn().mockResolvedValue(undefined);
    clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "setAppBadge", {
      configurable: true,
      writable: true,
      value: setAppBadgeMock,
    });
    Object.defineProperty(navigator, "clearAppBadge", {
      configurable: true,
      writable: true,
      value: clearAppBadgeMock,
    });
  });

  afterEach(() => {
    delete (navigator as Partial<NavWithBadge>).setAppBadge;
    delete (navigator as Partial<NavWithBadge>).clearAppBadge;
  });

  it("starts with badgeCount = 0", () => {
    const { result } = renderHook(() => useAppBadge());
    expect(result.current.badgeCount).toBe(0);
  });

  it("setBadge(n) updates count and calls navigator.setAppBadge(n)", async () => {
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(5);
    });
    expect(result.current.badgeCount).toBe(5);
    expect(setAppBadgeMock).toHaveBeenCalledWith(5);
    expect(clearAppBadgeMock).not.toHaveBeenCalled();
  });

  it("setBadge(0) clears the badge via clearAppBadge", async () => {
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(0);
    });
    expect(clearAppBadgeMock).toHaveBeenCalled();
    expect(setAppBadgeMock).not.toHaveBeenCalled();
  });

  it("clearBadge() routes through setBadge(0)", async () => {
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(7);
    });
    await act(async () => {
      await result.current.clearBadge();
    });
    expect(result.current.badgeCount).toBe(0);
    expect(clearAppBadgeMock).toHaveBeenCalled();
  });

  it("swallows navigator errors (logs only)", async () => {
    setAppBadgeMock.mockRejectedValueOnce(new Error("denied"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(3);
    });
    expect(result.current.badgeCount).toBe(3);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("no-op on platforms without the Badging API", async () => {
    delete (navigator as Partial<NavWithBadge>).setAppBadge;
    delete (navigator as Partial<NavWithBadge>).clearAppBadge;
    const { result } = renderHook(() => useAppBadge());
    await act(async () => {
      await result.current.setBadge(2);
    });
    expect(result.current.badgeCount).toBe(2);
  });
});
