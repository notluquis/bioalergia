import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSupplyManagement } from "../../src/features/supplies/hooks/useSupplyManagement";
import { ToastProvider } from "../../src/context/ToastContext";

vi.mock("../../src/features/supplies/api", () => ({
  getSupplyRequests: vi.fn(() =>
    Promise.resolve([
      {
        id: 1,
        supply_name: "Guantes",
        quantity: 10,
        status: "pending" as const,
        created_at: "2025-01-15",
      },
    ])
  ),
  getCommonSupplies: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: "Guantes", brand: "ACME", model: "M", description: null },
      { id: 2, name: "Guantes", brand: "ACME", model: "L", description: null },
    ])
  ),
  updateSupplyRequestStatus: vi.fn(() => Promise.resolve()),
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
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
};

describe("useSupplyManagement", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads requests and structures common supplies by brand/model", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplyManagement(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.structuredSupplies).toHaveProperty("Guantes");
    expect(result.current.structuredSupplies["Guantes"]).toHaveProperty("ACME");
    expect(result.current.structuredSupplies["Guantes"]?.["ACME"]).toEqual(["M", "L"]);
  });
});
