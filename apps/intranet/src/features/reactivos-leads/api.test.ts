/**
 * Tests for `apps/intranet/src/features/reactivos-leads/api.ts`.
 *
 * Golden 2026 patterns (mirrors features/roles/api.test.ts):
 * - `vi.hoisted` for the mocked oRPC client (factory hoisting safe).
 * - Mock the module boundary (`./orpc`).
 * - Cover success + error path for every exported wrapper. The wrappers
 *   don't re-validate the response, so the failure surface is the oRPC
 *   call rejecting → `toReactivosApiError` → `ApiError`.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type * as OrpcModule from "./orpc";
import { ApiError } from "@/lib/api-client";

const orpcMock = vi.hoisted(() => ({
  reactivosORPCClient: {
    listLeads: vi.fn(),
    updateLeadStatus: vi.fn(),
  },
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof OrpcModule>();
  return {
    ...actual,
    reactivosORPCClient: orpcMock.reactivosORPCClient,
  };
});

const api = await import("./api");

const fixtureLead = {
  id: 7,
  empresa: "Clínica Norte",
  contactName: "Ana Pérez",
  email: "ana@norte.cl",
  phone: null,
  rut: null,
  message: null,
  productsOfInterest: ["histamina"],
  status: "NUEVO" as const,
  source: "web",
  createdAt: new Date("2026-06-01T10:00:00Z"),
  updatedAt: new Date("2026-06-01T10:00:00Z"),
};

beforeEach(() => {
  for (const fn of Object.values(orpcMock.reactivosORPCClient)) {
    fn.mockReset();
  }
});

describe("listLeads", () => {
  it("returns the leads array (unwrapped)", async () => {
    orpcMock.reactivosORPCClient.listLeads.mockResolvedValueOnce({ leads: [fixtureLead] });
    await expect(api.listLeads()).resolves.toEqual([fixtureLead]);
    expect(orpcMock.reactivosORPCClient.listLeads).toHaveBeenCalledWith();
  });

  it("wraps oRPC errors as ApiError", async () => {
    orpcMock.reactivosORPCClient.listLeads.mockRejectedValueOnce(new Error("network"));
    await expect(api.listLeads()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("updateLeadStatus", () => {
  it("forwards id + status and returns the updated lead", async () => {
    orpcMock.reactivosORPCClient.updateLeadStatus.mockResolvedValueOnce({
      lead: { ...fixtureLead, status: "CONTACTADO" },
    });
    const input = { id: 7, status: "CONTACTADO" as const };
    await expect(api.updateLeadStatus(input)).resolves.toEqual({
      ...fixtureLead,
      status: "CONTACTADO",
    });
    expect(orpcMock.reactivosORPCClient.updateLeadStatus).toHaveBeenCalledWith(input);
  });

  it("wraps errors", async () => {
    orpcMock.reactivosORPCClient.updateLeadStatus.mockRejectedValueOnce(new Error("boom"));
    await expect(api.updateLeadStatus({ id: 7, status: "CERRADO" })).rejects.toBeInstanceOf(
      ApiError
    );
  });
});
