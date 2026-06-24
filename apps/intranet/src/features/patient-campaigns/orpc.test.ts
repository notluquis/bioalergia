/**
 * Tests for `toPatientCampaignsApiError` — error normalization for the
 * patient-campaigns orpc client.
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { toPatientCampaignsApiError } from "./orpc";

describe("toPatientCampaignsApiError", () => {
  it("returns ApiError instances unchanged (identity)", () => {
    const original = new ApiError("conflict", 409);
    expect(toPatientCampaignsApiError(original)).toBe(original);
  });

  it("maps ORPCError → ApiError preserving message + status + details", () => {
    const orpc = new ORPCError("BAD_REQUEST", {
      message: "RUT inválido",
      data: { field: "patientRut" },
    });
    const out = toPatientCampaignsApiError(orpc);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.message).toBe("RUT inválido");
    expect(out.status).toBe(orpc.status);
    expect(out.details).toEqual({ field: "patientRut" });
  });

  it("wraps generic Error as 500 ApiError", () => {
    const out = toPatientCampaignsApiError(new Error("boom"));
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("boom");
  });

  it("wraps unknown values with 'Error inesperado'", () => {
    const out = toPatientCampaignsApiError(undefined);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("Error inesperado");
  });
});
