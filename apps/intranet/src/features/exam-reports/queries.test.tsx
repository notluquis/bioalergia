/**
 * Tests for `examReportsKeys` queryOptions factory.
 *
 * Pattern: mock the orpc client at the module boundary, build a fresh
 * QueryClient per test, then drive useQuery via `renderHook` and
 * assert both the key shape and the queryFn forwarding.
 */

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  listTemplates: vi.fn(),
  getClinicSettings: vi.fn(),
  listAllergens: vi.fn(),
}));

vi.mock("./orpc", () => ({
  examReportsORPCClient: orpcMocks,
  toExamReportsApiError: (e: unknown) => e,
}));

const { examReportsKeys } = await import("./queries");

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

describe("examReportsKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("key shape", () => {
    it("all → ['exam-reports']", () => {
      expect(examReportsKeys.all).toEqual(["exam-reports"]);
    });

    it("lists() composes off all", () => {
      expect(examReportsKeys.lists()).toEqual(["exam-reports", "list"]);
    });

    it("list(params) uses {} fallback when undefined", () => {
      const opts = examReportsKeys.list();
      expect(opts.queryKey).toEqual(["exam-reports", "list", {}]);
    });

    it("list(params) includes params object verbatim", () => {
      const params = { patientId: 7, search: "ana" };
      const opts = examReportsKeys.list(params);
      expect(opts.queryKey).toEqual(["exam-reports", "list", params]);
    });

    it("detail(id) keyed by id", () => {
      expect(examReportsKeys.detail(42).queryKey).toEqual(["exam-reports", "detail", 42]);
    });

    it("templates(null) and templates(undefined) normalize to null", () => {
      expect(examReportsKeys.templates().queryKey).toEqual(["exam-reports", "templates", null]);
      expect(examReportsKeys.templates(null).queryKey).toEqual(["exam-reports", "templates", null]);
    });

    it("templates('PATCH') includes the exam type", () => {
      expect(examReportsKeys.templates("PATCH").queryKey).toEqual([
        "exam-reports",
        "templates",
        "PATCH",
      ]);
    });

    it("allergens defaults to {}", () => {
      expect(examReportsKeys.allergens().queryKey).toEqual(["exam-reports", "allergens", {}]);
    });
  });

  describe("queryFn forwarding (happy path)", () => {
    it("list forwards params to orpc.list", async () => {
      orpcMocks.list.mockResolvedValue({ reports: [] });
      const wrapper = buildWrapper();
      const { result } = renderHook(
        () => useQuery(examReportsKeys.list({ patientId: 3, limit: 5 })),
        { wrapper }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(orpcMocks.list).toHaveBeenCalledWith({ patientId: 3, limit: 5 });
    });

    it("detail calls orpc.get with {id}", async () => {
      orpcMocks.get.mockResolvedValue({ report: { id: 99 } });
      const wrapper = buildWrapper();
      const { result } = renderHook(() => useQuery(examReportsKeys.detail(99)), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(orpcMocks.get).toHaveBeenCalledWith({ id: 99 });
    });

    it("templates passes undefined when called with null", async () => {
      orpcMocks.listTemplates.mockResolvedValue({ templates: [] });
      const wrapper = buildWrapper();
      const { result } = renderHook(() => useQuery(examReportsKeys.templates(null)), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(orpcMocks.listTemplates).toHaveBeenCalledWith({ examType: undefined });
    });

    it("clinicSettings calls getClinicSettings with empty object", async () => {
      orpcMocks.getClinicSettings.mockResolvedValue({ settings: { name: "Bioalergia" } });
      const wrapper = buildWrapper();
      const { result } = renderHook(() => useQuery(examReportsKeys.clinicSettings()), {
        wrapper,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(orpcMocks.getClinicSettings).toHaveBeenCalledWith({});
    });
  });

  describe("error path", () => {
    it("surfaces queryFn rejection through useQuery error state", async () => {
      orpcMocks.list.mockRejectedValue(new Error("boom"));
      const wrapper = buildWrapper();
      const { result } = renderHook(() => useQuery(examReportsKeys.list()), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toBe("boom");
    });
  });
});
