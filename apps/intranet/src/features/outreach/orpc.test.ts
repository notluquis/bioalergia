/**
 * Tests for `toOutreachApiError` — error normalization for the
 * outreach orpc client.
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { toOutreachApiError } from "./orpc";

describe("toOutreachApiError", () => {
  it("returns ApiError instances unchanged", () => {
    const original = new ApiError("forbidden", 403);
    expect(toOutreachApiError(original)).toBe(original);
  });

  it("maps ORPCError to ApiError keeping message + status", () => {
    const orpc = new ORPCError("NOT_FOUND", { message: "rbd not found" });
    const out = toOutreachApiError(orpc);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.message).toBe("rbd not found");
    expect(out.status).toBe(orpc.status);
  });

  it("wraps plain Error → ApiError(500)", () => {
    const out = toOutreachApiError(new Error("dns failure"));
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("dns failure");
  });

  it("wraps unknown values with 'Error inesperado'", () => {
    const out = toOutreachApiError(null);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("Error inesperado");
    expect(out.details).toBeNull();
  });
});
