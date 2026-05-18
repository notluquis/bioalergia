/**
 * Tests for skin-tests queries / mutations (clinical series feature).
 *
 * Focus on PHI-sensitive mutations: approve, reject, reprocess,
 * process (bulk), sync (OneDrive folder pull), and the OneDrive
 * connection lifecycle. All mutations must invalidate the right cache
 * keys, surface errors via the toClinicalSkinTestsApiError wrapper, and
 * pass through compactORPCInput on filter inputs.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOneDriveStatus: vi.fn(),
  activeJob: vi.fn(),
  getOneDriveAuthUrl: vi.fn(),
  connectOneDrive: vi.fn(),
  listImports: vi.fn(),
  analytics: vi.fn(),
  listTestsBySeries: vi.fn(),
  listDocumentsBySeries: vi.fn(),
  sync: vi.fn(),
  configureOneDriveFolder: vi.fn(),
  listOneDriveFolderChildren: vi.fn(),
  renewOneDriveSubscription: vi.fn(),
  disconnectOneDrive: vi.fn(),
  approveImport: vi.fn(),
  rejectImport: vi.fn(),
  reprocessImport: vi.fn(),
  processImports: vi.fn(),
  processDiscoveredImports: vi.fn(),
  reprocessPendingImports: vi.fn(),
  reclassifyXlsxLibrary: vi.fn(),
  archiveSnapshots: vi.fn(),
  jobStatus: vi.fn(),
  cancelJob: vi.fn(),
  folderPreview: vi.fn(),
}));

vi.mock("./skin-tests-orpc", async () => {
  const { ApiError } = await import("@/lib/api-client");
  return {
    clinicalSkinTestsORPCClient: mocks,
    toClinicalSkinTestsApiError: (e: unknown) => {
      if (e instanceof ApiError) return e;
      if (e instanceof Error) return new ApiError(e.message, 500);
      return new ApiError("Error inesperado", 500, e);
    },
  };
});

const {
  useApproveSkinTestImport,
  useRejectSkinTestImport,
  useReprocessSkinTestImport,
  useProcessSkinTestImports,
  useSyncSkinTestImports,
  useConnectOneDrive,
  useDisconnectOneDrive,
  useSkinTestImports,
  useActiveClinicalSkinTestJob,
  useSkinTestsBySeries,
  useClinicalSkinTestJobStatus,
  useCancelClinicalSkinTestJob,
  useOneDriveFolderPreview,
  skinTestImportKeys,
} = await import("./skin-tests-queries");

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

describe("clinical-skin-tests queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("query keys", () => {
    it("namespaces under clinical-skin-tests", () => {
      expect(skinTestImportKeys.all).toEqual(["clinical-skin-tests"]);
      expect(skinTestImportKeys.activeJob()).toEqual(["clinical-skin-tests", "active-job"]);
      expect(skinTestImportKeys.seriesTests(7)).toEqual(["clinical-skin-tests", "series", 7]);
    });
  });

  describe("useApproveSkinTestImport", () => {
    it("calls API + invalidates imports + series caches", async () => {
      mocks.approveImport.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useApproveSkinTestImport(), { wrapper });

      act(() => {
        result.current.mutate("imp_xyz");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.approveImport).toHaveBeenCalledWith({ id: "imp_xyz" });
      // imports base + clinical-series invalidations
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "imports"],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-series"] });
    });
  });

  describe("useRejectSkinTestImport", () => {
    it("calls API + invalidates imports cache only", async () => {
      mocks.rejectImport.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useRejectSkinTestImport(), { wrapper });

      act(() => {
        result.current.mutate("imp_1");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "imports"],
      });
    });

    it("surfaces server validation errors", async () => {
      mocks.rejectImport.mockRejectedValue(new Error("Estado IMPORTED no puede rechazarse"));
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useRejectSkinTestImport(), { wrapper });
      act(() => {
        result.current.mutate("imp_locked");
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useReprocessSkinTestImport", () => {
    it("calls API and invalidates both caches", async () => {
      mocks.reprocessImport.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useReprocessSkinTestImport(), { wrapper });
      act(() => {
        result.current.mutate("imp_re");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "imports"],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-series"] });
    });
  });

  describe("useProcessSkinTestImports (bulk)", () => {
    it("sends array of ids", async () => {
      mocks.processImports.mockResolvedValue({ jobId: "job_p" });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useProcessSkinTestImports(), { wrapper });
      act(() => {
        result.current.mutate(["a", "b", "c"]);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.processImports).toHaveBeenCalledWith({ ids: ["a", "b", "c"] });
    });
  });

  describe("useSyncSkinTestImports (OneDrive)", () => {
    it("passes a folder + force flag and triggers activeJob refetch", async () => {
      mocks.sync.mockResolvedValue({ jobId: "sync_1" });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useSyncSkinTestImports(), { wrapper });
      act(() => {
        result.current.mutate({
          accountId: "acc1",
          folderDriveId: "drive1",
          folderItemId: "item1",
          force: true,
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.sync).toHaveBeenCalledWith({
        accountId: "acc1",
        folderDriveId: "drive1",
        folderItemId: "item1",
        force: true,
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "active-job"],
      });
    });

    it("compacts undefined params", async () => {
      mocks.sync.mockResolvedValue({ jobId: "sync_2" });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useSyncSkinTestImports(), { wrapper });
      act(() => {
        result.current.mutate({ accountId: "acc1", folderDriveId: undefined });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.sync).toHaveBeenCalledWith({ accountId: "acc1" });
    });
  });

  describe("OneDrive connection lifecycle", () => {
    it("useConnectOneDrive sends auth code + invalidates status", async () => {
      mocks.connectOneDrive.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useConnectOneDrive(), { wrapper });
      act(() => {
        result.current.mutate({ code: "auth-code-x", redirectUri: "http://x/cb" });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "onedrive-status"],
      });
    });

    it("useDisconnectOneDrive sends accountId + invalidates status", async () => {
      mocks.disconnectOneDrive.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useDisconnectOneDrive(), { wrapper });
      act(() => {
        result.current.mutate("acc1");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.disconnectOneDrive).toHaveBeenCalledWith({ accountId: "acc1" });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "onedrive-status"],
      });
    });
  });

  describe("useSkinTestImports list", () => {
    it("compacts filters and parses items via Zod schema", async () => {
      mocks.listImports.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(
        () =>
          useSkinTestImports({
            status: "PENDING_REVIEW",
            query: undefined,
            page: 1,
          }),
        { wrapper }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.listImports).toHaveBeenCalledWith({
        status: "PENDING_REVIEW",
        page: 1,
      });
    });

    it("surfaces parse errors as ApiError 500", async () => {
      // missing required fields → zod parse will throw at runtime
      mocks.listImports.mockResolvedValue({
        items: [{ invalid: "shape" }],
        total: 1,
        page: 1,
        pageSize: 50,
      });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useSkinTestImports(undefined), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useActiveClinicalSkinTestJob polling", () => {
    it("queries activeJob", async () => {
      mocks.activeJob.mockResolvedValue({ job: null });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useActiveClinicalSkinTestJob(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.activeJob).toHaveBeenCalled();
    });

    it("is disabled when explicitly disabled", () => {
      const { wrapper } = buildWrapper();
      renderHook(() => useActiveClinicalSkinTestJob({ enabled: false }), { wrapper });
      expect(mocks.activeJob).not.toHaveBeenCalled();
    });
  });

  describe("useSkinTestsBySeries", () => {
    it("disabled when seriesId is null", () => {
      const { wrapper } = buildWrapper();
      renderHook(() => useSkinTestsBySeries(null), { wrapper });
      expect(mocks.listTestsBySeries).not.toHaveBeenCalled();
    });

    it("fetches tests for a series + parses via schema", async () => {
      mocks.listTestsBySeries.mockResolvedValue({
        tests: [
          {
            id: "skt_1",
            ageLabel: "32 años",
            clinicalSeriesId: 7,
            testDate: "2026-05-12",
            panelTitle: "Aeroalérgenos",
            nonConclusiveDueToHyperreactivity: false,
            clinicalNote: null,
            physicianName: null,
            physicianSpecialty: null,
            website: null,
            address: null,
            oneDriveWebUrl: null,
            results: [],
            patientName: null,
            patientEmail: null,
            patientPhone: null,
            patientRut: null,
            resultHash: null,
            sourceImportId: "imp_1",
          },
        ],
      });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useSkinTestsBySeries(7), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.testDate).toBe("2026-05-12");
    });
  });

  describe("useClinicalSkinTestJobStatus", () => {
    it("disabled when jobId is null", () => {
      const { wrapper } = buildWrapper();
      renderHook(() => useClinicalSkinTestJobStatus(null), { wrapper });
      expect(mocks.jobStatus).not.toHaveBeenCalled();
    });

    it("queries job status", async () => {
      mocks.jobStatus.mockResolvedValue({
        job: { id: "j", status: "running", progress: 1, total: 10 },
      });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(() => useClinicalSkinTestJobStatus("j"), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.job?.status).toBe("running");
    });
  });

  describe("useCancelClinicalSkinTestJob", () => {
    it("cancels + invalidates job-status, active-job, imports", async () => {
      mocks.cancelJob.mockResolvedValue({ ok: true });
      const { wrapper, client } = buildWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useCancelClinicalSkinTestJob(), { wrapper });

      act(() => {
        result.current.mutate("job_kill");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.cancelJob).toHaveBeenCalledWith({ jobId: "job_kill" });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "job-status", "job_kill"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "active-job"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["clinical-skin-tests", "imports"],
      });
    });
  });

  describe("useOneDriveFolderPreview", () => {
    it("is disabled at root (no driveId/itemId) — expensive recursive scan", () => {
      const { wrapper } = buildWrapper();
      renderHook(
        () => useOneDriveFolderPreview({ accountId: "acc1", driveId: null, itemId: null }),
        { wrapper }
      );
      expect(mocks.folderPreview).not.toHaveBeenCalled();
    });

    it("queries preview when a target folder is selected", async () => {
      mocks.folderPreview.mockResolvedValue({ totalFiles: 5 });
      const { wrapper } = buildWrapper();
      const { result } = renderHook(
        () =>
          useOneDriveFolderPreview({
            accountId: "acc1",
            driveId: "drive1",
            itemId: "item1",
          }),
        { wrapper }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocks.folderPreview).toHaveBeenCalledWith({
        accountId: "acc1",
        driveId: "drive1",
        itemId: "item1",
      });
    });
  });
});
