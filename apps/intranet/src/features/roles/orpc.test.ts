/**
 * Tests for `toRolesApiError` — the error normalizer at the oRPC boundary.
 *
 * Golden 2026: normalize ALL error shapes to `ApiError` so call-sites have
 * one type to handle. Cover each branch (ApiError pass-through, ORPCError
 * conversion, generic Error wrap, unknown fallback).
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { toRolesApiError } from "./orpc";

describe("toRolesApiError", () => {
  it("returns the same ApiError instance when given one (no double-wrap)", () => {
    const original = new ApiError("Boom", 422, { field: "name" });
    const result = toRolesApiError(original);
    expect(result).toBe(original);
    expect(result.status).toBe(422);
    expect(result.details).toEqual({ field: "name" });
  });

  it("converts an ORPCError to ApiError preserving status + data", () => {
    const orpcError = new ORPCError("FORBIDDEN", {
      message: "No tienes permisos",
      data: { reason: "missing_role" },
    });
    const result = toRolesApiError(orpcError);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.message).toBe("No tienes permisos");
    expect(result.details).toEqual({ reason: "missing_role" });
    expect(typeof result.status).toBe("number");
  });

  it("wraps a generic Error with status 500", () => {
    const result = toRolesApiError(new Error("Connection refused"));
    expect(result).toBeInstanceOf(ApiError);
    expect(result.message).toBe("Connection refused");
    expect(result.status).toBe(500);
  });

  it("falls back to a generic ApiError for unknown shapes", () => {
    const result = toRolesApiError({ weird: "object" });
    expect(result).toBeInstanceOf(ApiError);
    expect(result.message).toBe("Error inesperado");
    expect(result.status).toBe(500);
    expect(result.details).toEqual({ weird: "object" });
  });

  it("falls back to a generic ApiError for null/undefined", () => {
    expect(toRolesApiError(null).message).toBe("Error inesperado");
    expect(toRolesApiError(undefined).message).toBe("Error inesperado");
  });
});
