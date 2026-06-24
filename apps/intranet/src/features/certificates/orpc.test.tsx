/**
 * Tests for certificates `orpc.ts` — error normalization via
 * toCertificatesApiError.
 *
 * Certificates feature currently only exposes an oRPC client + error
 * mapper (no React components, no api wrappers yet). Covering the
 * mapper guarantees that downstream callers (PDF generation, certificate
 * verification) always surface an ApiError they can pattern-match on.
 */

import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { toCertificatesApiError } from "./orpc";
import { ApiError } from "@/lib/api-client";

describe("certificates/orpc — toCertificatesApiError", () => {
  it("returns ApiError unchanged when passed an ApiError", () => {
    const original = new ApiError("already mapped", 422, { rut: "12345670-K" });
    expect(toCertificatesApiError(original)).toBe(original);
  });

  it("maps ORPCError preserving status, message, and validation data", () => {
    // Simulates server-side Zod failure on generateMedical input
    // (e.g. invalid RUT, malformed date, missing diagnosis).
    const orpc = new ORPCError("BAD_REQUEST", {
      message: "Invalid certificate input",
      status: 400,
      data: {
        issues: [
          { path: ["rut"], message: "invalid RUT" },
          { path: ["birthDate"], message: "must be YYYY-MM-DD" },
        ],
      },
    });

    const result = toCertificatesApiError(orpc);

    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(400);
    expect(result.message).toBe("Invalid certificate input");
    expect(result.details).toEqual({
      issues: [
        { path: ["rut"], message: "invalid RUT" },
        { path: ["birthDate"], message: "must be YYYY-MM-DD" },
      ],
    });
  });

  it("maps verify-not-found (ORPCError 404) into a typed ApiError", () => {
    const orpc = new ORPCError("NOT_FOUND", {
      message: "certificate not found",
      status: 404,
      data: { id: "cert-missing" },
    });
    const result = toCertificatesApiError(orpc);
    expect(result.status).toBe(404);
    expect(result.details).toEqual({ id: "cert-missing" });
  });

  it("wraps PDF generation crashes (plain Error) as ApiError 500", () => {
    const result = toCertificatesApiError(new Error("pdfkit failed to render"));
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("pdfkit failed to render");
  });

  it("wraps non-Error throws (network rejected with a string) safely", () => {
    const result = toCertificatesApiError("upstream timeout");
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.message).toBe("Error inesperado");
    expect(result.details).toBe("upstream timeout");
  });

  it("handles null/undefined gracefully", () => {
    expect(toCertificatesApiError(null).status).toBe(500);
    expect(toCertificatesApiError(undefined).status).toBe(500);
  });
});
