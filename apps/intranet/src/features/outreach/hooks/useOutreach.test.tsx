/**
 * Tests for `useOutreach` hooks — covers the queries (key shape +
 * forwarding) and the mutation surface (createCampaign, launch, MINEDUC
 * import, Google Places discovery, delivery batches) plus error paths.
 *
 * Golden 2026: vi.hoisted shared mock state, fresh QueryClient per
 * test, module-boundary mock of `../orpc`.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  filtersMeta: vi.fn(),
  listEstablishments: vi.fn(),
  getEstablishment: vi.fn(),
  updateEstablishment: vi.fn(),
  bulkUpdateEstablishments: vi.fn(),
  upsertContact: vi.fn(),
  deleteContact: vi.fn(),
  createInteraction: vi.fn(),
  deleteInteraction: vi.fn(),
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  launchCampaign: vi.fn(),
  pauseCampaign: vi.fn(),
  previewCampaign: vi.fn(),
  importMineduc: vi.fn(),
  zonas: vi.fn(),
  discoverGooglePlaces: vi.fn(),
  crawlProspect: vi.fn(),
  apolloEnrich: vi.fn(),
  hunterDomain: vi.fn(),
  hunterVerifyEmail: vi.fn(),
  recomputeScore: vi.fn(),
  bulkCrawl: vi.fn(),
  bulkCrawlStatus: vi.fn(),
  nextDeliveryBatch: vi.fn(),
  recordDeliveryResult: vi.fn(),
}));

vi.mock("../orpc", () => ({
  outreachORPCClient: orpcMocks,
}));

const {
  useBulkCrawlStatus,
  useCampaign,
  useCreateCampaign,
  useDashboard,
  useDiscoverGooglePlaces,
  useEstablishment,
  useEstablishments,
  useImportMineduc,
  useLaunchCampaign,
  useNextDeliveryBatch,
  useRecordDeliveryResult,
} = await import("./useOutreach");

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDashboard", () => {
  it("calls dashboard({}) and returns data", async () => {
    orpcMocks.dashboard.mockResolvedValue({ total: 10 });
    const { result } = renderHook(() => useDashboard(), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.dashboard).toHaveBeenCalledWith({});
    expect(result.current.data).toEqual({ total: 10 });
  });

  it("surfaces error state on rejection", async () => {
    orpcMocks.dashboard.mockRejectedValue(new Error("forbidden"));
    const { result } = renderHook(() => useDashboard(), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("forbidden");
  });
});

describe("useEstablishments", () => {
  it("applies page/pageSize/sort defaults when omitted", async () => {
    orpcMocks.listEstablishments.mockResolvedValue({ rows: [], total: 0 });
    const { result } = renderHook(() => useEstablishments({}), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = orpcMocks.listEstablishments.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.page).toBe(1);
    expect(call.pageSize).toBe(50);
    expect(call.sortBy).toBe("nombre");
    expect(call.sortDir).toBe("asc");
  });

  it("passes through filter params", async () => {
    orpcMocks.listEstablishments.mockResolvedValue({ rows: [] });
    renderHook(
      () =>
        useEstablishments({
          page: 3,
          search: "Liceo",
          dependencias: ["MUNICIPAL"],
          soloConEmail: true,
        }),
      { wrapper: buildWrapper() }
    );
    await waitFor(() => expect(orpcMocks.listEstablishments).toHaveBeenCalled());
    const call = orpcMocks.listEstablishments.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.page).toBe(3);
    expect(call.search).toBe("Liceo");
    expect(call.dependencias).toEqual(["MUNICIPAL"]);
    expect(call.soloConEmail).toBe(true);
  });
});

describe("useEstablishment", () => {
  it("does not fire when rbd is undefined", async () => {
    renderHook(() => useEstablishment(undefined), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.getEstablishment).not.toHaveBeenCalled();
  });

  it("calls getEstablishment with rbd when provided", async () => {
    orpcMocks.getEstablishment.mockResolvedValue({ rbd: "1234" });
    const { result } = renderHook(() => useEstablishment("1234"), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.getEstablishment).toHaveBeenCalledWith({ rbd: "1234" });
  });
});

describe("useCreateCampaign", () => {
  it("mutation calls createCampaign and resolves with data", async () => {
    orpcMocks.createCampaign.mockResolvedValue({ id: 7, status: "BORRADOR" });
    const { result } = renderHook(() => useCreateCampaign(), { wrapper: buildWrapper() });
    const payload = { name: "Otoño 2026", canal: "EMAIL" } as never;
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync(payload);
    });
    expect(orpcMocks.createCampaign).toHaveBeenCalledWith(payload);
    expect(returned).toEqual({ id: 7, status: "BORRADOR" });
  });

  it("surfaces error from server", async () => {
    orpcMocks.createCampaign.mockRejectedValue(new Error("subject vacío"));
    const { result } = renderHook(() => useCreateCampaign(), { wrapper: buildWrapper() });
    await expect(result.current.mutateAsync({} as never)).rejects.toThrow("subject vacío");
  });
});

describe("useLaunchCampaign", () => {
  it("forwards the id to launchCampaign", async () => {
    orpcMocks.launchCampaign.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLaunchCampaign(), { wrapper: buildWrapper() });
    await act(async () => {
      await result.current.mutateAsync(42);
    });
    expect(orpcMocks.launchCampaign).toHaveBeenCalledWith({ id: 42 });
  });
});

describe("useCampaign", () => {
  it("disabled when id is undefined", async () => {
    renderHook(() => useCampaign(undefined), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.getCampaign).not.toHaveBeenCalled();
  });

  it("forwards id when provided", async () => {
    orpcMocks.getCampaign.mockResolvedValue({ id: 99 });
    const { result } = renderHook(() => useCampaign(99), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.getCampaign).toHaveBeenCalledWith({ id: 99 });
  });
});

describe("useImportMineduc", () => {
  it("forwards the import payload and reports success", async () => {
    orpcMocks.importMineduc.mockResolvedValue({ inserted: 120, updated: 5 });
    const { result } = renderHook(() => useImportMineduc(), { wrapper: buildWrapper() });
    const payload = { region: "RM", year: 2026 } as never;
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync(payload);
    });
    expect(orpcMocks.importMineduc).toHaveBeenCalledWith(payload);
    expect(returned).toEqual({ inserted: 120, updated: 5 });
  });

  it("surfaces parse errors from the server", async () => {
    orpcMocks.importMineduc.mockRejectedValue(new Error("CSV malformed"));
    const { result } = renderHook(() => useImportMineduc(), { wrapper: buildWrapper() });
    await expect(result.current.mutateAsync({} as never)).rejects.toThrow("CSV malformed");
  });
});

describe("useDiscoverGooglePlaces", () => {
  it("forwards query and returns discovered count", async () => {
    orpcMocks.discoverGooglePlaces.mockResolvedValue({ discovered: 8 });
    const { result } = renderHook(() => useDiscoverGooglePlaces(), { wrapper: buildWrapper() });
    const input = { query: "colegio", comuna: "Providencia" } as never;
    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(input);
    });
    expect(orpcMocks.discoverGooglePlaces).toHaveBeenCalledWith(input);
    expect(res).toEqual({ discovered: 8 });
  });
});

describe("useBulkCrawlStatus polling", () => {
  it("does not fire when jobId is null", async () => {
    renderHook(() => useBulkCrawlStatus(null), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.bulkCrawlStatus).not.toHaveBeenCalled();
  });

  it("queries with jobId when provided", async () => {
    orpcMocks.bulkCrawlStatus.mockResolvedValue({ status: "completed", processed: 3 });
    const { result } = renderHook(() => useBulkCrawlStatus("job-1"), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.bulkCrawlStatus).toHaveBeenCalledWith({ jobId: "job-1" });
  });
});

describe("delivery batch mutations", () => {
  it("useNextDeliveryBatch forwards { campaignId, limit }", async () => {
    orpcMocks.nextDeliveryBatch.mockResolvedValue({ batch: [] });
    const { result } = renderHook(() => useNextDeliveryBatch(), { wrapper: buildWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ campaignId: 1, limit: 25 });
    });
    expect(orpcMocks.nextDeliveryBatch).toHaveBeenCalledWith({ campaignId: 1, limit: 25 });
  });

  it("useRecordDeliveryResult forwards full record", async () => {
    orpcMocks.recordDeliveryResult.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useRecordDeliveryResult(), { wrapper: buildWrapper() });
    const payload = { id: 5, status: "ENVIADO" } as never;
    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    expect(orpcMocks.recordDeliveryResult).toHaveBeenCalledWith(payload);
  });
});
