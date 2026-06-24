/**
 * Tests for clinical-series queries + mutations.
 *
 * Coverage:
 *  - list/detail/insuranceStats happy paths (filter shape verified)
 *  - rebuild → returns jobId
 *  - merge two series — invalidates entire feature cache (cascade safety)
 *  - abandonment contacts CRUD
 *  - error paths via toClinicalSeriesApiError wrapper
 *  - SSE rebuild progress hook closes on unmount
 *
 * PHI: snapshots use FAKE valid Chilean RUTs (12345670-K, 5126663-3 ?
 * here we use mod-11 valid: 11111111-1, 12345678-5).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  insuranceStats: vi.fn(),
  rebuild: vi.fn(),
  detectDuplicates: vi.fn(),
  merge: vi.fn(),
  listAbandonmentContacts: vi.fn(),
  createAbandonmentContact: vi.fn(),
}));

vi.mock("./orpc", async () => {
  const { ApiError } = await import("@/lib/api-client");
  return {
    clinicalSeriesORPCClient: mocks,
    toClinicalSeriesApiError: (e: unknown) => {
      if (e instanceof ApiError) return e;
      if (e instanceof Error) return new ApiError(e.message, 500);
      return new ApiError("Error inesperado", 500, e);
    },
  };
});

const {
  fetchClinicalSeries,
  fetchClinicalSeriesDetail,
  fetchClinicalSeriesInsuranceStats,
  rebuildClinicalSeries,
  fetchDetectDuplicates,
  mergeClinicalSeries,
  fetchAbandonmentContacts,
  useClinicalSeries,
  useClinicalSeriesDetail,
  useDetectDuplicates,
  useRebuildClinicalSeries,
  useMergeClinicalSeries,
  useAbandonmentContacts,
  useCreateAbandonmentContact,
  useClinicalSeriesRebuildProgress,
  clinicalSeriesKeys,
} = await import("./queries");

const FAKE_RUT = "12345678-5"; // valid Chilean RUT format placeholder

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    allergenType: null,
    abandonmentBucket: null,
    daysSinceLastEvent: 30,
    vaccineProduct: null,
    healthInsurance: "PARTICULAR",
    isapreName: null,
    deliveryModality: null,
    beneficiaryName: "Ana Pérez",
    beneficiaryPhones: [],
    beneficiaryRut: FAKE_RUT,
    id: 1,
    kind: "SUBCUTANEOUS_TREATMENT",
    lastAbandonmentContact: null,
    status: "ACTIVE",
    displayName: "Tratamiento subcutáneo",
    patientName: "Ana Pérez",
    patientPhones: [],
    patientRut: FAKE_RUT,
    events: [],
    linkedDocuments: [],
    lastEventDate: "2026-04-01",
    nextEventDate: "2026-06-01",
    totalExpected: 100000,
    totalPaid: 50000,
    totalLinkedAmount: 50000,
    remainingExpected: 50000,
    remainingPaid: 0,
    eligibleDocumentDateFrom: "2025-01-01",
    eligibleDocumentDateTo: "2026-12-31",
    upcomingCount: 2,
    ...overrides,
  };
}

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("clinical-series queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("query keys", () => {
    it("keeps stable hierarchical structure", () => {
      expect(clinicalSeriesKeys.all).toEqual(["clinical-series"]);
      expect(clinicalSeriesKeys.detail(7)).toEqual(["clinical-series", "detail", 7]);
      expect(clinicalSeriesKeys.list({ status: "ACTIVE" })).toEqual([
        "clinical-series",
        "list",
        { status: "ACTIVE" },
      ]);
    });
  });

  describe("fetchClinicalSeries (filter compaction)", () => {
    it("filters out undefined values via compactORPCInput", async () => {
      mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
      await fetchClinicalSeries({
        status: "ACTIVE",
        kind: undefined,
        query: undefined,
      });
      // compactORPCInput strips `undefined` keys → only status survives
      expect(mocks.list).toHaveBeenCalledWith({ status: "ACTIVE" });
    });

    it("passes empty object when no filters provided", async () => {
      mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
      await fetchClinicalSeries(undefined);
      expect(mocks.list).toHaveBeenCalledWith({});
    });

    it("wraps server errors into ApiError", async () => {
      mocks.list.mockRejectedValue(new Error("DB connection lost"));
      const { ApiError } = await import("@/lib/api-client");
      await expect(fetchClinicalSeries(undefined)).rejects.toBeInstanceOf(ApiError);
    });

    it("parses snapshot items through Zod schema", async () => {
      mocks.list.mockResolvedValue({
        items: [snapshot()],
        total: 1,
        page: 1,
        pageSize: 50,
      });
      const result = await fetchClinicalSeries(undefined);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(1);
    });
  });

  describe("fetchClinicalSeriesDetail", () => {
    it("fetches by id and parses response", async () => {
      mocks.detail.mockResolvedValue(snapshot({ id: 99 }));
      const result = await fetchClinicalSeriesDetail(99);
      expect(mocks.detail).toHaveBeenCalledWith({ id: 99 });
      expect(result.id).toBe(99);
    });
  });

  describe("fetchClinicalSeriesInsuranceStats", () => {
    it("returns parsed stats", async () => {
      mocks.insuranceStats.mockResolvedValue({
        fonasa: 5,
        isapre: 10,
        isapreProviders: [{ providerName: "Banmédica", total: 3 }],
        isapreUnidentified: 1,
        particular: 20,
        total: 35,
        unidentified: 0,
      });
      const stats = await fetchClinicalSeriesInsuranceStats(undefined);
      expect(stats.fonasa).toBe(5);
      expect(stats.isapreProviders[0]?.providerName).toBe("Banmédica");
    });
  });

  describe("rebuildClinicalSeries", () => {
    it("returns jobId from server", async () => {
      mocks.rebuild.mockResolvedValue({ jobId: "rb_1", message: "Iniciado" });
      const r = await rebuildClinicalSeries({ autoMerge: true });
      expect(r.jobId).toBe("rb_1");
    });
  });

  describe("fetchDetectDuplicates", () => {
    it("returns array of duplicates", async () => {
      mocks.detectDuplicates.mockResolvedValue({
        duplicates: [
          {
            confidence: "high",
            kind: "SUBCUTANEOUS_TREATMENT",
            patientName: "Ana",
            reason: "Mismo paciente, fechas solapadas",
            sourceEventCount: 3,
            sourceId: 1,
            sourcePatientName: "Ana Pérez",
            sourcePatientRut: FAKE_RUT,
            targetEventCount: 5,
            targetId: 2,
          },
        ],
      });
      const dups = await fetchDetectDuplicates();
      expect(dups).toHaveLength(1);
      expect(dups[0]?.confidence).toBe("high");
    });
  });

  describe("mergeClinicalSeries (HIGH RISK)", () => {
    it("posts both ids and reason", async () => {
      mocks.merge.mockResolvedValue({ eventsMovedCount: 7, targetId: 2 });
      const r = await mergeClinicalSeries({
        sourceId: 1,
        targetId: 2,
        mergeReason: "Duplicado confirmado por operador",
      });
      expect(mocks.merge).toHaveBeenCalledWith({
        sourceId: 1,
        targetId: 2,
        mergeReason: "Duplicado confirmado por operador",
      });
      expect(r.eventsMovedCount).toBe(7);
    });

    it("surfaces server-side validation rejection (403)", async () => {
      mocks.merge.mockRejectedValue(new Error("No autorizado"));
      await expect(mergeClinicalSeries({ sourceId: 1, targetId: 2 })).rejects.toThrow(
        "No autorizado"
      );
    });
  });

  describe("useClinicalSeries hook", () => {
    it("queries with filters", async () => {
      mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(
        () => useClinicalSeries({ status: "ACTIVE", kind: "SUBCUTANEOUS_TREATMENT" }),
        { wrapper }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.list).toHaveBeenCalledWith({
        status: "ACTIVE",
        kind: "SUBCUTANEOUS_TREATMENT",
      });
    });

    it("exposes error state when server returns 500", async () => {
      mocks.list.mockRejectedValue(new Error("Boom"));
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useClinicalSeries(undefined), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useClinicalSeriesDetail", () => {
    it("is disabled when id is 0/falsy", () => {
      const { wrapper } = buildWrapper();
      renderHook(() => useClinicalSeriesDetail(0), { wrapper });
      expect(mocks.detail).not.toHaveBeenCalled();
    });

    it("fetches detail when id provided", async () => {
      mocks.detail.mockResolvedValue(snapshot({ id: 5 }));
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useClinicalSeriesDetail(5), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.id).toBe(5);
    });
  });

  describe("useDetectDuplicates", () => {
    it("queries duplicates list", async () => {
      mocks.detectDuplicates.mockResolvedValue({ duplicates: [] });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useDetectDuplicates(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });
  });

  describe("useRebuildClinicalSeries", () => {
    it("calls rebuild mutation", async () => {
      mocks.rebuild.mockResolvedValue({ jobId: "rb_2", message: "ok" });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useRebuildClinicalSeries(), { wrapper });
      act(() => {
        result.current.mutate({});
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.jobId).toBe("rb_2");
    });
  });

  describe("useMergeClinicalSeries (cache cascade)", () => {
    it("invalidates entire clinical-series cache on success", async () => {
      mocks.merge.mockResolvedValue({ eventsMovedCount: 3, targetId: 2 });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useMergeClinicalSeries(), { wrapper });

      act(() => {
        result.current.mutate({ sourceId: 1, targetId: 2 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-series"] });
    });

    it("surfaces merge errors and does NOT invalidate cache", async () => {
      mocks.merge.mockRejectedValue(new Error("Conflict: targetId immutable"));
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useMergeClinicalSeries(), { wrapper });

      act(() => {
        result.current.mutate({ sourceId: 1, targetId: 2 });
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(invalidate).not.toHaveBeenCalled();
    });
  });

  describe("abandonment contacts", () => {
    it("fetchAbandonmentContacts parses list", async () => {
      mocks.listAbandonmentContacts.mockResolvedValue({
        contacts: [
          {
            id: 1,
            seriesId: 99,
            outcome: "WILL_RETURN",
            notes: "Paciente retoma en julio",
            contactedById: 4,
            contactedByName: "Recep. María",
            contactedAt: "2026-05-12T10:00:00.000Z",
          },
        ],
      });
      const result = await fetchAbandonmentContacts(99);
      expect(result).toHaveLength(1);
      expect(result[0]?.outcome).toBe("WILL_RETURN");
    });

    it("useAbandonmentContacts disabled when seriesId is null", () => {
      const { wrapper } = buildWrapper();
      renderHook(() => useAbandonmentContacts(null), { wrapper });
      expect(mocks.listAbandonmentContacts).not.toHaveBeenCalled();
    });

    it("useCreateAbandonmentContact persists + invalidates the right keys", async () => {
      mocks.createAbandonmentContact.mockResolvedValue({
        id: 2,
        seriesId: 99,
        outcome: "DECLINED",
        notes: null,
        contactedById: 4,
        contactedByName: "M",
        contactedAt: "2026-05-12T10:00:00.000Z",
      });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useCreateAbandonmentContact(), { wrapper });

      act(() => {
        result.current.mutate({ seriesId: 99, outcome: "DECLINED" });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["abandonment-contacts", 99],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-series"] });
    });

    it("useCreateAbandonmentContact surfaces server errors", async () => {
      mocks.createAbandonmentContact.mockRejectedValue(new Error("Forbidden"));
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useCreateAbandonmentContact(), { wrapper });
      act(() => {
        result.current.mutate({ seriesId: 99, outcome: "OTHER" });
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useClinicalSeriesRebuildProgress (SSE)", () => {
    class FakeEventSource {
      static instances: FakeEventSource[] = [];
      url: string;
      listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
      closed = false;
      constructor(url: string) {
        this.url = url;
        FakeEventSource.instances.push(this);
      }
      addEventListener(type: string, fn: (e: MessageEvent) => void) {
        (this.listeners[type] ??= []).push(fn);
      }
      close() {
        this.closed = true;
      }
    }

    beforeEach(() => {
      FakeEventSource.instances = [];
      vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("connects to /api/clinical-series/progress and closes on unmount", () => {
      const { wrapper } = buildWrapper();
      const { unmount } = renderHook(() => useClinicalSeriesRebuildProgress(), { wrapper });
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(FakeEventSource.instances[0]?.url).toBe("/api/clinical-series/progress");
      unmount();
      expect(FakeEventSource.instances[0]?.closed).toBe(true);
    });

    it("invalidates clinical-series cache when job transitions to completed", async () => {
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useClinicalSeriesRebuildProgress(), { wrapper });
      const es = FakeEventSource.instances[0]!;

      // First: emit a running job (no invalidation yet)
      act(() => {
        es.listeners.message?.forEach((fn) =>
          fn({
            data: JSON.stringify({
              job: {
                jobId: "j",
                status: "running",
                progress: 50,
                total: 100,
                processed: 50,
                currentStep: "merging",
                from: null,
                to: null,
              },
            }),
          } as MessageEvent)
        );
      });
      await waitFor(() => expect(result.current?.status).toBe("running"));
      invalidate.mockClear();

      // Then: transition to completed → invalidate cache
      act(() => {
        es.listeners.message?.forEach((fn) =>
          fn({
            data: JSON.stringify({
              job: {
                jobId: "j",
                status: "completed",
                progress: 100,
                total: 100,
                processed: 100,
                currentStep: "done",
                from: null,
                to: null,
              },
            }),
          } as MessageEvent)
        );
      });
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-series"] })
      );
    });
  });
});
