/**
 * Tests for the patient-campaigns queries module. Covers:
 * - Key shape stability (used as TanStack Query cache keys).
 * - Fetcher functions: forwarding + ApiError mapping on rejection.
 * - Hooks: enabled guards, query forwarding, mutations (create/update/
 *   delete campaigns, upsert/update-status/delete recipients) for both
 *   happy + error paths.
 *
 * Golden 2026: vi.hoisted mocks, fresh QueryClient per test, no
 * cross-test cache bleed.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  listRecipients: vi.fn(),
  listByPatient: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  upsertRecipient: vi.fn(),
  updateRecipientStatus: vi.fn(),
  deleteRecipient: vi.fn(),
}));

vi.mock("./orpc", async () => {
  const actual = await vi.importActual<typeof import("./orpc")>("./orpc");
  return {
    patientCampaignsORPCClient: orpcMocks,
    toPatientCampaignsApiError: actual.toPatientCampaignsApiError,
  };
});

const {
  fetchCampaignRecipients,
  fetchPatientCampaign,
  fetchPatientCampaigns,
  fetchRecipientsByPatient,
  patientCampaignsKeys,
  useCampaignRecipients,
  useCreatePatientCampaign,
  useDeleteCampaignRecipient,
  useDeletePatientCampaign,
  usePatientCampaign,
  usePatientCampaigns,
  usePatientCampaignsByPatient,
  useUpdatePatientCampaign,
  useUpdateRecipientStatus,
  useUpsertCampaignRecipient,
} = await import("./queries");
const { ApiError } = await import("@/lib/api-client");

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

// Valid Chilean RUTs (modulo-11 verifier).
const VALID_RUT = "12345678-5";
const VALID_RUT_2 = "11111111-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("patientCampaignsKeys", () => {
  it("all → ['patient-campaigns']", () => {
    expect(patientCampaignsKeys.all).toEqual(["patient-campaigns"]);
  });

  it("lists() composes off all", () => {
    expect(patientCampaignsKeys.lists()).toEqual(["patient-campaigns", "list"]);
  });

  it("list() defaults params to {}", () => {
    expect(patientCampaignsKeys.list()).toEqual(["patient-campaigns", "list", {}]);
  });

  it("list(params) includes includeInactive flag", () => {
    expect(patientCampaignsKeys.list({ includeInactive: true })).toEqual([
      "patient-campaigns",
      "list",
      { includeInactive: true },
    ]);
  });

  it("detail(id) keyed by numeric id", () => {
    expect(patientCampaignsKeys.detail(7)).toEqual(["patient-campaigns", "detail", 7]);
  });

  it("recipientsByCampaign keyed by campaign + filters", () => {
    expect(patientCampaignsKeys.recipientsByCampaign(3, { status: "SENT" })).toEqual([
      "patient-campaigns",
      "recipients",
      "campaign",
      3,
      { status: "SENT" },
    ]);
  });

  it("recipientsByPatient keyed by RUT", () => {
    expect(patientCampaignsKeys.recipientsByPatient(VALID_RUT)).toEqual([
      "patient-campaigns",
      "recipients",
      "patient",
      VALID_RUT,
    ]);
  });
});

describe("fetcher functions", () => {
  it("fetchPatientCampaigns returns the campaigns array", async () => {
    orpcMocks.listCampaigns.mockResolvedValue({ campaigns: [{ id: 1 }] });
    const out = await fetchPatientCampaigns();
    expect(orpcMocks.listCampaigns).toHaveBeenCalledWith({});
    expect(out).toEqual([{ id: 1 }]);
  });

  it("fetchPatientCampaigns rethrows as ApiError", async () => {
    orpcMocks.listCampaigns.mockRejectedValue(new Error("nope"));
    await expect(fetchPatientCampaigns()).rejects.toBeInstanceOf(ApiError);
  });

  it("fetchPatientCampaign unwraps result.campaign", async () => {
    orpcMocks.getCampaign.mockResolvedValue({ campaign: { id: 9 } });
    await expect(fetchPatientCampaign(9)).resolves.toEqual({ id: 9 });
    expect(orpcMocks.getCampaign).toHaveBeenCalledWith({ id: 9 });
  });

  it("fetchCampaignRecipients forwards filters", async () => {
    orpcMocks.listRecipients.mockResolvedValue({ recipients: [] });
    await fetchCampaignRecipients({ campaignId: 1, status: "PENDING", query: "lopez" });
    expect(orpcMocks.listRecipients).toHaveBeenCalledWith({
      campaignId: 1,
      status: "PENDING",
      query: "lopez",
    });
  });

  it("fetchRecipientsByPatient wraps errors as ApiError", async () => {
    orpcMocks.listByPatient.mockRejectedValue(new Error("dns"));
    await expect(fetchRecipientsByPatient(VALID_RUT)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("query hooks", () => {
  it("usePatientCampaigns success", async () => {
    orpcMocks.listCampaigns.mockResolvedValue({ campaigns: [{ id: 1 }] });
    const { result } = renderHook(() => usePatientCampaigns(), { wrapper: buildWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1 }]);
  });

  it("usePatientCampaign disabled when id is undefined", async () => {
    renderHook(() => usePatientCampaign(undefined), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.getCampaign).not.toHaveBeenCalled();
  });

  it("usePatientCampaign disabled when id is 0", async () => {
    renderHook(() => usePatientCampaign(0), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.getCampaign).not.toHaveBeenCalled();
  });

  it("useCampaignRecipients applies filters when provided, omits when not", async () => {
    orpcMocks.listRecipients.mockResolvedValue({ recipients: [] });
    const { result, rerender } = renderHook(
      ({ filters }: { filters?: { status?: "SENT"; query?: string } }) =>
        useCampaignRecipients(4, filters),
      {
        wrapper: buildWrapper(),
        initialProps: {} as { filters?: { status?: "SENT"; query?: string } },
      }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.listRecipients).toHaveBeenLastCalledWith({ campaignId: 4 });

    rerender({ filters: { status: "SENT", query: "ana" } });
    await waitFor(() =>
      expect(orpcMocks.listRecipients).toHaveBeenLastCalledWith({
        campaignId: 4,
        status: "SENT",
        query: "ana",
      })
    );
  });

  it("usePatientCampaignsByPatient disabled when rut is undefined", async () => {
    renderHook(() => usePatientCampaignsByPatient(undefined), { wrapper: buildWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(orpcMocks.listByPatient).not.toHaveBeenCalled();
  });

  it("usePatientCampaignsByPatient calls listByPatient with the RUT", async () => {
    orpcMocks.listByPatient.mockResolvedValue({ recipients: [] });
    const { result } = renderHook(() => usePatientCampaignsByPatient(VALID_RUT), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orpcMocks.listByPatient).toHaveBeenCalledWith({ patientRut: VALID_RUT });
  });
});

describe("campaign mutations", () => {
  it("useCreatePatientCampaign happy path", async () => {
    orpcMocks.createCampaign.mockResolvedValue({ campaign: { id: 1, name: "Onda 2026" } });
    const { result } = renderHook(() => useCreatePatientCampaign(), { wrapper: buildWrapper() });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ name: "Onda 2026" });
    });
    expect(returned).toEqual({ id: 1, name: "Onda 2026" });
    expect(orpcMocks.createCampaign).toHaveBeenCalledWith({ name: "Onda 2026" });
  });

  it("useCreatePatientCampaign error path → ApiError", async () => {
    orpcMocks.createCampaign.mockRejectedValue(new Error("name vacío"));
    const { result } = renderHook(() => useCreatePatientCampaign(), { wrapper: buildWrapper() });
    await expect(result.current.mutateAsync({ name: "" })).rejects.toBeInstanceOf(ApiError);
  });

  it("useUpdatePatientCampaign forwards full payload", async () => {
    orpcMocks.updateCampaign.mockResolvedValue({ campaign: { id: 2, name: "Edit" } });
    const { result } = renderHook(() => useUpdatePatientCampaign(), { wrapper: buildWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 2, name: "Edit", isActive: false });
    });
    expect(orpcMocks.updateCampaign).toHaveBeenCalledWith({
      id: 2,
      name: "Edit",
      isActive: false,
    });
  });

  it("useDeletePatientCampaign resolves with id", async () => {
    orpcMocks.deleteCampaign.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useDeletePatientCampaign(), { wrapper: buildWrapper() });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync(11);
    });
    expect(orpcMocks.deleteCampaign).toHaveBeenCalledWith({ id: 11 });
    expect(returned).toBe(11);
  });
});

describe("recipient mutations", () => {
  it("useUpsertCampaignRecipient forwards full input", async () => {
    orpcMocks.upsertRecipient.mockResolvedValue({
      recipient: { id: 50, campaignId: 1, patientRut: VALID_RUT },
    });
    const { result } = renderHook(() => useUpsertCampaignRecipient(), {
      wrapper: buildWrapper(),
    });
    const input = {
      campaignId: 1,
      patientRut: VALID_RUT,
      patientName: "Juan Pérez",
      patientPhone: "+56912345678",
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(orpcMocks.upsertRecipient).toHaveBeenCalledWith(input);
  });

  it("useUpdateRecipientStatus forwards status + notes", async () => {
    orpcMocks.updateRecipientStatus.mockResolvedValue({
      recipient: { id: 60, campaignId: 2, status: "ACCEPTED" },
    });
    const { result } = renderHook(() => useUpdateRecipientStatus(), { wrapper: buildWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 60, status: "ACCEPTED", notes: "Confirmado" });
    });
    expect(orpcMocks.updateRecipientStatus).toHaveBeenCalledWith({
      id: 60,
      status: "ACCEPTED",
      notes: "Confirmado",
    });
  });

  it("useUpdateRecipientStatus surfaces ApiError on rejection", async () => {
    orpcMocks.updateRecipientStatus.mockRejectedValue(new Error("forbidden"));
    const { result } = renderHook(() => useUpdateRecipientStatus(), { wrapper: buildWrapper() });
    await expect(result.current.mutateAsync({ id: 1, status: "DISMISSED" })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it("useDeleteCampaignRecipient resolves with id and calls deleteRecipient", async () => {
    orpcMocks.deleteRecipient.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useDeleteCampaignRecipient(), {
      wrapper: buildWrapper(),
    });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync(77);
    });
    expect(orpcMocks.deleteRecipient).toHaveBeenCalledWith({ id: 77 });
    expect(returned).toBe(77);
  });

  it("useUpsertCampaignRecipient works for a second valid RUT", async () => {
    orpcMocks.upsertRecipient.mockResolvedValue({
      recipient: { id: 51, campaignId: 1, patientRut: VALID_RUT_2 },
    });
    const { result } = renderHook(() => useUpsertCampaignRecipient(), {
      wrapper: buildWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ campaignId: 1, patientRut: VALID_RUT_2 });
    });
    expect(orpcMocks.upsertRecipient).toHaveBeenCalledWith({
      campaignId: 1,
      patientRut: VALID_RUT_2,
    });
  });
});
