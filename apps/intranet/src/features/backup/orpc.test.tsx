/**
 * Tests for backup `orpc.ts` — error normalization via toBackupsApiError.
 *
 * Module-boundary inputs only (ORPCError, ApiError, plain Error, unknown).
 * No mocks needed: pure error mapping logic.
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { toBackupsApiError } from "./orpc";
import { ApiError } from "@/lib/api-client";

describe("backup/orpc — toBackupsApiError", () => {
  it("returns ApiError unchanged when passed an ApiError", () => {
    const original = new ApiError("already mapped", 418, { foo: 1 });
    expect(toBackupsApiError(original)).toBe(original);
  });

  it("maps ORPCError preserving status, message, and data payload", () => {
    const orpc = new ORPCError("NOT_FOUND", {
      message: "backup not found",
      status: 404,
      data: { fileId: "drive-file-99" },
    });
    const result = toBackupsApiError(orpc);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(404);
    expect(result.message).toBe("backup not found");
    expect(result.details).toEqual({ fileId: "drive-file-99" });
  });

  it("wraps a plain Error as ApiError with status 500", () => {
    const result = toBackupsApiError(new Error("boom"));
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("boom");
  });

  it("wraps non-Error values as a generic ApiError with status 500", () => {
    const result = toBackupsApiError("string-thrown");
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBe("string-thrown");
  });

  it("handles null/undefined gracefully", () => {
    expect(toBackupsApiError(null).status).toBe(500);
    expect(toBackupsApiError(undefined).status).toBe(500);
  });
});
