/**
 * Tests for `useQualityAlerts` — surfaces toasts when the per-phone
 * quality summary degrades (rating drops to RED, or new critical
 * unacknowledged alerts arrive).
 *
 * Golden 2026 patterns:
 *  - `vi.hoisted` shared mock state lets us flip the summary between
 *    renders without rebuilding the QueryClient.
 *  - QueryClient per test, retries disabled.
 *  - We mock the entire `./useWaCloud` module boundary so this test
 *    never touches `waCloudORPCClient` or the network.
 *  - Cover BOTH degradation paths (RED drop + new critical) plus
 *    quiet-first-render guard.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

const qualityState = vi.hoisted(() => ({
  data: null as null | { criticalUnacknowledged: number; qualityRating: string | null },
}));

vi.mock("@/lib/toast-interceptor", () => ({ toast: toastMock }));

vi.mock("./useWaCloud", () => ({
  usePhoneQualitySummary: () => ({ data: qualityState.data }),
}));

const { useQualityAlerts } = await import("./useQualityAlerts");

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useQualityAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qualityState.data = null;
  });

  it("stays quiet on first render (no baseline to compare against)", async () => {
    qualityState.data = { criticalUnacknowledged: 5, qualityRating: "RED" };
    const wrapper = buildWrapper();
    renderHook(() => useQualityAlerts(42), { wrapper });
    // Give effects a chance to flush.
    await new Promise((r) => setTimeout(r, 10));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("does nothing while quality data is undefined", async () => {
    qualityState.data = null;
    const wrapper = buildWrapper();
    renderHook(() => useQualityAlerts(42), { wrapper });
    await new Promise((r) => setTimeout(r, 10));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("toasts when criticalUnacknowledged grows between renders", async () => {
    qualityState.data = { criticalUnacknowledged: 1, qualityRating: "GREEN" };
    const wrapper = buildWrapper();
    const { rerender } = renderHook(() => useQualityAlerts(42), { wrapper });

    qualityState.data = { criticalUnacknowledged: 4, qualityRating: "GREEN" };
    rerender();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("3 sin reconocer"))
    );
  });

  it("toasts a RED-drop warning when rating transitions GREEN→RED", async () => {
    qualityState.data = { criticalUnacknowledged: 0, qualityRating: "GREEN" };
    const wrapper = buildWrapper();
    const { rerender } = renderHook(() => useQualityAlerts(42), { wrapper });

    qualityState.data = { criticalUnacknowledged: 0, qualityRating: "RED" };
    rerender();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("RED"))
    );
  });

  it("does not double-fire when rating stays RED", async () => {
    qualityState.data = { criticalUnacknowledged: 0, qualityRating: "RED" };
    const wrapper = buildWrapper();
    const { rerender } = renderHook(() => useQualityAlerts(42), { wrapper });

    qualityState.data = { criticalUnacknowledged: 0, qualityRating: "RED" };
    rerender();

    await new Promise((r) => setTimeout(r, 10));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("does not toast when critical count is unchanged or decreases", async () => {
    qualityState.data = { criticalUnacknowledged: 3, qualityRating: "YELLOW" };
    const wrapper = buildWrapper();
    const { rerender } = renderHook(() => useQualityAlerts(42), { wrapper });

    qualityState.data = { criticalUnacknowledged: 1, qualityRating: "YELLOW" };
    rerender();

    await new Promise((r) => setTimeout(r, 10));
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
