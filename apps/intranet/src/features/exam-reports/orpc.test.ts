/**
 * Tests for `toExamReportsApiError` — error normalization for the
 * exam-reports orpc client. Covers ORPCError → ApiError, plain Error
 * → 500 ApiError, unknown thrown values, and identity passthrough.
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { toExamReportsApiError } from "./orpc";

describe("toExamReportsApiError", () => {
  it("returns the same instance when the error is already ApiError", () => {
    const original = new ApiError("nope", 418, { teapot: true });
    expect(toExamReportsApiError(original)).toBe(original);
  });

  it("maps ORPCError → ApiError preserving status + details", () => {
    const orpc = new ORPCError("CONFLICT", { message: "duplicate", data: { id: 1 } });
    const out = toExamReportsApiError(orpc);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.message).toBe("duplicate");
    expect(out.status).toBe(orpc.status);
    expect(out.details).toEqual({ id: 1 });
  });

  it("wraps plain Error as 500 ApiError", () => {
    const out = toExamReportsApiError(new Error("network down"));
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("network down");
  });

  it("wraps unknown thrown values as 500 with generic message", () => {
    const out = toExamReportsApiError({ weird: "shape" });
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
    expect(out.message).toBe("Error inesperado");
    expect(out.details).toEqual({ weird: "shape" });
  });

  it("wraps string thrown values", () => {
    const out = toExamReportsApiError("oops");
    expect(out).toBeInstanceOf(ApiError);
    expect(out.status).toBe(500);
  });
});
