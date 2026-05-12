import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { AppError } from "../lib/app-error.ts";
import { GoogleApiError } from "../lib/google/google-errors.ts";
import { toORPCError } from "./error.ts";

describe("toORPCError", () => {
  it("maps Google Drive errors to stable oRPC errors", () => {
    const error = new GoogleApiError({
      code: 503,
      domain: "global",
      message:
        "drive.files.get: Google Drive temporalmente no disponible. Intenta en unos minutos.",
      originalError: new Error("upstream unavailable"),
      reason: "backendError",
      retryAfterSeconds: 30,
      status: "UNAVAILABLE",
    });

    const result = toORPCError(error);

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.status).toBe(503);
    expect(result.message).toContain("Google Drive temporalmente no disponible");
    expect(result.data).toEqual({
      domain: "global",
      provider: "google-drive",
      reason: "backendError",
      retryAfterSeconds: 30,
    });
  });

  it("downgrades non-standard upstream statuses to 500", () => {
    const error = new GoogleApiError({
      code: 520,
      domain: "global",
      message: "Unknown upstream error",
      originalError: new Error("edge failure"),
      reason: "unknown",
      status: undefined,
    });

    const result = toORPCError(error);

    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.status).toBe(500);
  });

  it("preserves exposed AppError metadata", () => {
    const error = new AppError(409, {
      code: "BACKUP_CONFLICT",
      details: { fileId: "abc123" },
      message: "Ya existe un backup en progreso.",
    });

    const result = toORPCError(error);

    expect(result.code).toBe("CONFLICT");
    expect(result.status).toBe(409);
    expect(result.message).toBe("Ya existe un backup en progreso.");
    expect(result.data).toEqual({
      appCode: "BACKUP_CONFLICT",
      details: { fileId: "abc123" },
    });
  });
});
