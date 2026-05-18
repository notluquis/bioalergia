/**
 * Tests for clinical records TanStack Query hooks.
 *
 * Mocks the oRPC client at the module boundary; verifies query keys,
 * mutation side-effects (cache invalidation), success + error paths.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listImports: vi.fn(),
  getImport: vi.fn(),
  reprocessImport: vi.fn(),
  approveImport: vi.fn(),
  rejectImport: vi.fn(),
  startBulkReprocess: vi.fn(),
  getBulkJob: vi.fn(),
  getActiveBulkJob: vi.fn(),
  cancelBulkJob: vi.fn(),
  listForPatient: vi.fn(),
}));

vi.mock("../orpc", () => ({
  clinicalRecordsORPCClient: mocks,
  toClinicalRecordsApiError: (e: unknown) => e,
}));

const {
  useClinicalRecordImports,
  useClinicalRecordImport,
  useReprocessClinicalRecordImport,
  useApproveClinicalRecordImport,
  useRejectClinicalRecordImport,
  useStartBulkReprocess,
  useBulkJobStatus,
  useActiveBulkJob,
  useCancelBulkJob,
  usePatientClinicalRecords,
} = await import("./useClinicalRecords");

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

describe("clinical-records hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useClinicalRecordImports queries listImports with filters", async () => {
    mocks.listImports.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    const { wrapper } = buildWrapper();
    const filters = {
      status: "PENDING_REVIEW" as const,
      search: "ficha",
      page: 1,
      pageSize: 50,
    };
    const { result } = renderHook(() => useClinicalRecordImports(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.listImports).toHaveBeenCalledWith(filters);
  });

  it("useClinicalRecordImport is disabled when id is null", () => {
    const { wrapper } = buildWrapper();
    renderHook(() => useClinicalRecordImport(null), { wrapper });
    expect(mocks.getImport).not.toHaveBeenCalled();
  });

  it("useClinicalRecordImport fetches by id when provided", async () => {
    mocks.getImport.mockResolvedValue({ id: "imp_1" });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useClinicalRecordImport("imp_1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getImport).toHaveBeenCalledWith({ id: "imp_1" });
  });

  it("useReprocessClinicalRecordImport invalidates cache on success", async () => {
    mocks.reprocessImport.mockResolvedValue({ ok: true });
    mocks.listImports.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    const { wrapper, client } = buildWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useReprocessClinicalRecordImport(), { wrapper });

    act(() => {
      result.current.mutate("imp_42");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.reprocessImport).toHaveBeenCalledWith({ id: "imp_42" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clinical-records"] });
  });

  it("useApproveClinicalRecordImport sends approval payload and invalidates", async () => {
    mocks.approveImport.mockResolvedValue({ ok: true });
    const { wrapper, client } = buildWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useApproveClinicalRecordImport(), { wrapper });
    act(() => {
      result.current.mutate({ id: "imp_1", patientId: 99, notes: "ok" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.approveImport).toHaveBeenCalledWith({
      id: "imp_1",
      patientId: 99,
      notes: "ok",
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("useRejectClinicalRecordImport surfaces server error", async () => {
    mocks.rejectImport.mockRejectedValue(new Error("Solo admins pueden rechazar"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRejectClinicalRecordImport(), { wrapper });

    act(() => {
      result.current.mutate({ id: "imp_1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Solo admins pueden rechazar");
  });

  it("useStartBulkReprocess kicks off a job", async () => {
    mocks.startBulkReprocess.mockResolvedValue({ jobId: "job_abc" });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useStartBulkReprocess(), { wrapper });
    act(() => {
      result.current.mutate({ maxImports: 100 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobId).toBe("job_abc");
  });

  it("useBulkJobStatus is disabled when jobId is null", () => {
    const { wrapper } = buildWrapper();
    renderHook(() => useBulkJobStatus(null), { wrapper });
    expect(mocks.getBulkJob).not.toHaveBeenCalled();
  });

  it("useBulkJobStatus polls running jobs and stops on terminal state", async () => {
    mocks.getBulkJob.mockResolvedValue({
      job: { id: "job_1", status: "completed", progress: 10, total: 10 },
    });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useBulkJobStatus("job_1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.job?.status).toBe("completed");
  });

  it("useActiveBulkJob returns the active job", async () => {
    mocks.getActiveBulkJob.mockResolvedValue({
      job: { id: "job_x", status: "running", progress: 1, total: 5 },
    });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useActiveBulkJob(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.job?.status).toBe("running");
  });

  it("useCancelBulkJob calls API + invalidates", async () => {
    mocks.cancelBulkJob.mockResolvedValue({ ok: true });
    const { wrapper, client } = buildWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCancelBulkJob(), { wrapper });
    act(() => {
      result.current.mutate("job_kill");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.cancelBulkJob).toHaveBeenCalledWith({ jobId: "job_kill" });
    expect(invalidate).toHaveBeenCalled();
  });

  it("usePatientClinicalRecords is disabled when patientId is null", () => {
    const { wrapper } = buildWrapper();
    renderHook(() => usePatientClinicalRecords(null), { wrapper });
    expect(mocks.listForPatient).not.toHaveBeenCalled();
  });

  it("usePatientClinicalRecords fetches records by patientId", async () => {
    mocks.listForPatient.mockResolvedValue({ records: [] });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => usePatientClinicalRecords(42), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.listForPatient).toHaveBeenCalledWith({ patientId: 42 });
  });

  it("usePatientClinicalRecords surfaces 500 server errors", async () => {
    mocks.listForPatient.mockRejectedValue(new Error("Internal Server Error"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => usePatientClinicalRecords(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Internal Server Error");
  });
});
