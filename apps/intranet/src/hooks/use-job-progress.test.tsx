/**
 * Tests for `useJobProgress` — polls calendar job status via TanStack Query
 * suspense and triggers onComplete / onError callbacks.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCalendarJobStatusMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/calendar/api", () => ({
  fetchCalendarJobStatus: fetchCalendarJobStatusMock,
}));

import { useJobProgress } from "./use-job-progress";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <Suspense fallback={<div>loading</div>}>{children}</Suspense>
      </QueryClientProvider>
    );
  }
  return { client, Wrapper };
}

beforeEach(() => {
  fetchCalendarJobStatusMock.mockReset();
});

describe("useJobProgress", () => {
  it("returns null job and 0 progress when jobId is null", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobProgress(null), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.job).toBeNull();
    });
    expect(result.current.progress).toBe(0);
    expect(fetchCalendarJobStatusMock).not.toHaveBeenCalled();
  });

  it("computes percentage progress from progress / total", async () => {
    fetchCalendarJobStatusMock.mockResolvedValue({
      status: "running",
      progress: 25,
      total: 100,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobProgress("job-1"), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.job?.status).toBe("running");
    });
    expect(result.current.progress).toBe(25);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isFailed).toBe(false);
  });

  it("calls onComplete with the result when the job completes", async () => {
    fetchCalendarJobStatusMock.mockResolvedValue({
      status: "completed",
      progress: 10,
      total: 10,
      result: { ok: true },
    });
    const onComplete = vi.fn();
    const { Wrapper } = makeWrapper();
    renderHook(() => useJobProgress("job-c", { onComplete }), { wrapper: Wrapper });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ ok: true });
    });
  });

  it("calls onError with the error message when the job fails", async () => {
    fetchCalendarJobStatusMock.mockResolvedValue({
      status: "failed",
      progress: 0,
      total: 10,
      error: "Boom",
    });
    const onError = vi.fn();
    const { Wrapper } = makeWrapper();
    renderHook(() => useJobProgress("job-f", { onError }), { wrapper: Wrapper });
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Boom");
    });
  });

  it("exposes a `reset` function", async () => {
    fetchCalendarJobStatusMock.mockResolvedValue({
      status: "completed",
      progress: 1,
      total: 1,
      result: null,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobProgress("job-x"), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });
    expect(typeof result.current.reset).toBe("function");
  });
});
