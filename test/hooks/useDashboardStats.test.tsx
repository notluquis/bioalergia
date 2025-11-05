import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardStats } from "../../src/features/dashboard/hooks";

vi.mock("../../src/features/dashboard/api", () => ({
  fetchStats: vi.fn(() =>
    Promise.resolve({
      status: "ok" as const,
      monthly: [{ month: "2025-01", in: 100, out: 40, net: 60 }],
      totals: { IN: 100, OUT: 40 },
      byType: [],
    })
  ),
  fetchRecentMovements: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
};

describe("useDashboardStats", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes stats data once the query resolves", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useDashboardStats({ from: "2025-01-01", to: "2025-01-31" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.monthly[0]?.net).toBe(60);
    expect(result.current.data?.totals?.IN).toBe(100);
  });
});
